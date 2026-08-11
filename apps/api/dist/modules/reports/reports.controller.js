"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const vitamina_pulse_service_1 = require("./vitamina-pulse.service");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const monthly_reports_service_1 = require("./monthly-reports.service");
const monthly_report_dto_1 = require("./dto/monthly-report.dto");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let ReportingController = class ReportingController {
    constructor(dataSource, pulseService, accountAccess, monthlyReports) {
        this.dataSource = dataSource;
        this.pulseService = pulseService;
        this.accountAccess = accountAccess;
        this.monthlyReports = monthlyReports;
    }
    resolveClientScope(req) {
        if (req.user?.role !== user_role_enum_1.UserRole.CLIENT)
            return null;
        if (!req.user.clientId) {
            throw new common_1.ForbiddenException('El usuario cliente no tiene una cuenta asociada');
        }
        return req.user.clientId;
    }
    async pulse(req) {
        const clientId = this.resolveClientScope(req) ?? undefined;
        const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.pulseService.getPulse(req.organizationId, clientId, clientIds);
    }
    async dashboard(req) {
        const orgId = req.organizationId;
        const personal = [user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL].includes(req.user.role);
        const clientIds = await this.accountAccess.allowedClientIds(orgId, req.user);
        const clientScope = clientIds === undefined
            ? { sql: '', params: [] }
            : clientIds.length
                ? { sql: ` AND client_id IN (${clientIds.map(() => '?').join(',')})`, params: clientIds }
                : { sql: ' AND 1 = 0', params: [] };
        const clientRowScope = clientIds === undefined
            ? { sql: '', params: [] }
            : clientIds.length
                ? { sql: ` AND id IN (${clientIds.map(() => '?').join(',')})`, params: clientIds }
                : { sql: ' AND 1 = 0', params: [] };
        const [clientRow] = personal ? [{ total: 0 }] : await this.dataSource.query(`SELECT COUNT(*) as total FROM clients WHERE organization_id = ?${clientRowScope.sql} AND status = 'active'`, [orgId, ...clientRowScope.params]);
        const pieceRows = await this.dataSource.query(`SELECT status, COUNT(*) as count FROM pieces WHERE organization_id = ?${personal ? ' AND assigned_to = ?' : clientScope.sql} GROUP BY status`, personal ? [orgId, req.user.id] : [orgId, ...clientScope.params]);
        const [xpRow] = await this.dataSource.query(`SELECT COALESCE(SUM(points),0) as total FROM xp_events WHERE ${personal || req.user.role === user_role_enum_1.UserRole.COMMUNITY_MANAGER ? 'user_id = ?' : 'user_id IN (SELECT id FROM users WHERE organization_id = ?)'} AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)`, [personal || req.user.role === user_role_enum_1.UserRole.COMMUNITY_MANAGER ? req.user.id : orgId]);
        const [udRow] = personal ? [{ contracted: 0, consumed: 0, reserved: 0 }] : await this.dataSource.query(`SELECT COALESCE(SUM(contracted),0) as contracted, COALESCE(SUM(consumed),0) as consumed, COALESCE(SUM(reserved),0) as reserved FROM ud_budgets WHERE client_id IN (SELECT id FROM clients WHERE organization_id = ?${clientRowScope.sql})`, [orgId, ...clientRowScope.params]);
        const pendingPieces = pieceRows.reduce((sum, piece) => (piece.status !== 'delivered' && piece.status !== 'cancelled' ? sum + Number(piece.count) : sum), 0);
        const pieces = pieceRows.map((piece) => ({
            status: piece.status,
            count: Number(piece.count),
        }));
        return {
            activeClients: Number(clientRow?.total || 0),
            pendingPieces,
            teamXp: Number(xpRow?.total || 0),
            monthUd: Number(udRow?.consumed || 0),
            ud: {
                contracted: Number(udRow?.contracted || 0),
                consumed: Number(udRow?.consumed || 0),
                reserved: Number(udRow?.reserved || 0),
            },
            pieces,
        };
    }
    async reports(req) {
        const orgId = req.organizationId;
        const clientId = this.resolveClientScope(req);
        const allowedClientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        const invoiceConditions = ['organization_id = ?'];
        const invoiceParams = [orgId];
        const pieceConditions = ['organization_id = ?'];
        const pieceParams = [orgId];
        const clientConditions = ['organization_id = ?'];
        const clientParams = [orgId];
        if (clientId) {
            invoiceConditions.push('client_id = ?');
            invoiceParams.push(clientId);
            pieceConditions.push('client_id = ?');
            pieceParams.push(clientId);
            clientConditions.push('id = ?');
            clientParams.push(clientId);
        }
        else if (allowedClientIds !== undefined) {
            const scopedCondition = allowedClientIds.length
                ? `client_id IN (${allowedClientIds.map(() => '?').join(',')})`
                : '1 = 0';
            const scopedClientCondition = allowedClientIds.length
                ? `id IN (${allowedClientIds.map(() => '?').join(',')})`
                : '1 = 0';
            invoiceConditions.push(scopedCondition);
            invoiceParams.push(...allowedClientIds);
            pieceConditions.push(scopedCondition);
            pieceParams.push(...allowedClientIds);
            clientConditions.push(scopedClientCondition);
            clientParams.push(...allowedClientIds);
        }
        const topConditions = ['c.organization_id = ?'];
        const topParams = [orgId];
        if (clientId) {
            topConditions.push('c.id = ?');
            topParams.push(clientId);
        }
        else if (allowedClientIds !== undefined) {
            topConditions.push(allowedClientIds.length
                ? `c.id IN (${allowedClientIds.map(() => '?').join(',')})`
                : '1 = 0');
            topParams.push(...allowedClientIds);
        }
        const [[revRow], [projRow], [avgUdRow], monthlyRows, topRows] = await Promise.all([
            this.dataSource.query(`SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE ${invoiceConditions.join(' AND ')} AND status = 'paid'`, invoiceParams),
            this.dataSource.query(`SELECT COUNT(*) as total FROM pieces WHERE ${pieceConditions.join(' AND ')} AND status NOT IN ('delivered','cancelled')`, pieceParams),
            this.dataSource.query(`SELECT COALESCE(AVG(default_ud_budget),0) as avg FROM clients WHERE ${clientConditions.join(' AND ')}`, clientParams),
            this.dataSource.query(`SELECT months.month,
                COALESCE(revenue.total, 0) AS revenue,
                COALESCE(production.ud, 0) AS ud
         FROM (
           SELECT DATE_FORMAT(created_at, '%Y-%m') AS month FROM invoices
            WHERE ${invoiceConditions.join(' AND ')} AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
           UNION
           SELECT DATE_FORMAT(created_at, '%Y-%m') AS month FROM pieces
            WHERE ${pieceConditions.join(' AND ')} AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
         ) months
         LEFT JOIN (
           SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(total) AS total
           FROM invoices WHERE ${invoiceConditions.join(' AND ')} AND status = 'paid'
           GROUP BY month
         ) revenue ON revenue.month = months.month
         LEFT JOIN (
           SELECT DATE_FORMAT(created_at, '%Y-%m') AS month, SUM(ud_amount) AS ud
           FROM pieces WHERE ${pieceConditions.join(' AND ')} GROUP BY month
         ) production ON production.month = months.month
         ORDER BY months.month ASC`, [...invoiceParams, ...pieceParams, ...invoiceParams, ...pieceParams]),
            this.dataSource.query(`SELECT c.name, COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total ELSE 0 END),0) as revenue
         FROM clients c LEFT JOIN invoices i ON i.client_id = c.id
         WHERE ${topConditions.join(' AND ')}
         GROUP BY c.id ORDER BY revenue DESC LIMIT 5`, topParams),
        ]);
        const monthly = monthlyRows.map((r) => ({
            month: r.month,
            revenue: Number(r.revenue),
            ud: Number(r.ud),
        }));
        return {
            totalRevenue: Number(revRow?.total || 0),
            activeProjects: Number(projRow?.total || 0),
            avgUdPerClient: Math.round(Number(avgUdRow?.avg || 0)),
            monthlyData: monthly,
            topClients: topRows.map((row) => ({ name: row.name, revenue: Number(row.revenue) })),
        };
    }
    async kpi(req) {
        const orgId = req.organizationId;
        const allowed = await this.accountAccess.allowedClientIds(orgId, req.user);
        if (allowed?.length === 0) {
            return { revenueYtd: 0, activeClients: 0, contractedUd: 0, retentionPct: 0 };
        }
        const clientFilter = allowed ? `AND id IN (${allowed.map(() => '?').join(',')})` : '';
        const scopedFilter = allowed ? `AND client_id IN (${allowed.map(() => '?').join(',')})` : '';
        const scoped = allowed ?? [];
        const [revRow] = await this.dataSource.query(`SELECT COALESCE(SUM(total),0) as total FROM invoices WHERE organization_id = ? AND status = 'paid' AND YEAR(created_at) = YEAR(NOW()) ${scopedFilter}`, [orgId, ...scoped]);
        const [clientRow] = await this.dataSource.query(`SELECT COUNT(*) as total FROM clients WHERE organization_id = ? AND status = 'active' ${clientFilter}`, [orgId, ...scoped]);
        const [udRow] = await this.dataSource.query(`SELECT COALESCE(SUM(contracted),0) as total FROM ud_budgets WHERE client_id IN (SELECT id FROM clients WHERE organization_id = ? ${clientFilter})`, [orgId, ...scoped]);
        const [retRow] = await this.dataSource.query(`SELECT COUNT(DISTINCT client_id) * 100.0 / NULLIF((SELECT COUNT(*) FROM clients WHERE organization_id = ? ${clientFilter}), 0) as pct FROM pieces WHERE organization_id = ? AND status = 'delivered' ${scopedFilter}`, [orgId, ...scoped, orgId, ...scoped]);
        return {
            revenueYtd: Number(revRow?.total || 0),
            revenueTarget: null,
            activeClients: Number(clientRow?.total || 0),
            clientTarget: null,
            udSold: Number(udRow?.total || 0),
            udTarget: null,
            teamUtilization: null,
            utilizationTarget: null,
            clientRetention: Math.round(Number(retRow?.pct || 0)),
            nps: null,
            growthRate: null,
        };
    }
    async performance(req) {
        const clientId = this.resolveClientScope(req);
        const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        const conditions = ['organization_id = ?', 'metric_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)'];
        const params = [req.organizationId];
        if (clientId) {
            conditions.push('client_id = ?');
            params.push(clientId);
        }
        else if (clientIds !== undefined) {
            conditions.push(clientIds.length ? `client_id IN (${clientIds.map(() => '?').join(',')})` : '1 = 0');
            params.push(...clientIds);
        }
        const rows = await this.dataSource.query(`SELECT provider,
              SUM(spend) AS spend, SUM(impressions) AS impressions, SUM(reach) AS reach,
              SUM(clicks) AS clicks, SUM(leads) AS leads, SUM(conversions) AS conversions,
              MAX(metric_date) AS lastDataAt
       FROM integration_metrics WHERE ${conditions.join(' AND ')} GROUP BY provider ORDER BY provider`, params);
        const providers = rows.map((row) => ({
            provider: row.provider, spend: Number(row.spend), impressions: Number(row.impressions), reach: Number(row.reach),
            clicks: Number(row.clicks), leads: Number(row.leads), conversions: Number(row.conversions), lastDataAt: row.lastDataAt,
        }));
        const totals = providers.reduce((sum, row) => ({
            spend: sum.spend + row.spend, impressions: sum.impressions + row.impressions, reach: sum.reach + row.reach,
            clicks: sum.clicks + row.clicks, leads: sum.leads + row.leads, conversions: sum.conversions + row.conversions,
        }), { spend: 0, impressions: 0, reach: 0, clicks: 0, leads: 0, conversions: 0 });
        return {
            periodDays: 30, providers, totals,
            derived: {
                cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
                cpl: totals.leads > 0 ? totals.spend / totals.leads : null,
                ctr: totals.impressions > 0 ? totals.clicks * 100 / totals.impressions : null,
                conversionRate: totals.clicks > 0 ? totals.conversions * 100 / totals.clicks : null,
            },
            hasData: providers.length > 0,
        };
    }
    async listMonthlyReports(req, year, month, requestedClientId) {
        const clientId = this.resolveClientScope(req) ?? requestedClientId;
        if (clientId)
            await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.monthlyReports.list(req.organizationId, { clientId: clientId ?? undefined, clientIds, clientView: req.user.role === user_role_enum_1.UserRole.CLIENT, year: year ? Number(year) : undefined, month: month ? Number(month) : undefined });
    }
    async generateMonthlyReport(req, dto) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        return this.monthlyReports.generate(req.organizationId, req.user.id, dto);
    }
    updateMonthlyReport(req, id, dto) { return this.monthlyReports.update(id, req.organizationId, dto); }
    publishMonthlyReport(req, id) { return this.monthlyReports.setPublished(id, req.organizationId, req.user.id, true); }
    unpublishMonthlyReport(req, id) { return this.monthlyReports.setPublished(id, req.organizationId, req.user.id, false); }
};
exports.ReportingController = ReportingController;
__decorate([
    (0, common_1.Get)('pulse'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.AI_LEAD, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Pulso Vitamina explicable de la operación y la marca' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportingController.prototype, "pulse", null);
__decorate([
    (0, common_1.Get)('dashboard'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.AI_LEAD, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL),
    (0, swagger_1.ApiOperation)({ summary: 'Dashboard ejecutivo' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportingController.prototype, "dashboard", null);
__decorate([
    (0, common_1.Get)('reports'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.AI_LEAD, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Reportes generales' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportingController.prototype, "reports", null);
__decorate([
    (0, common_1.Get)('kpi'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.AI_LEAD),
    (0, swagger_1.ApiOperation)({ summary: 'KPIs estrategicos para direccion' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportingController.prototype, "kpi", null);
__decorate([
    (0, common_1.Get)('performance'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.AI_LEAD, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    (0, swagger_1.ApiOperation)({ summary: 'Rendimiento consolidado de Meta Ads, Google Ads y Analytics' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportingController.prototype, "performance", null);
__decorate([
    (0, common_1.Get)('monthly-reports'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CLIENT),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('year')),
    __param(2, (0, common_1.Query)('month')),
    __param(3, (0, common_1.Query)('clientId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], ReportingController.prototype, "listMonthlyReports", null);
__decorate([
    (0, common_1.Post)('monthly-reports/generate'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, monthly_report_dto_1.GenerateMonthlyReportDto]),
    __metadata("design:returntype", Promise)
], ReportingController.prototype, "generateMonthlyReport", null);
__decorate([
    (0, common_1.Put)('monthly-reports/:id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, monthly_report_dto_1.UpdateMonthlyReportDto]),
    __metadata("design:returntype", void 0)
], ReportingController.prototype, "updateMonthlyReport", null);
__decorate([
    (0, common_1.Post)('monthly-reports/:id/publish'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReportingController.prototype, "publishMonthlyReport", null);
__decorate([
    (0, common_1.Post)('monthly-reports/:id/unpublish'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], ReportingController.prototype, "unpublishMonthlyReport", null);
exports.ReportingController = ReportingController = __decorate([
    (0, swagger_1.ApiTags)('Reportes'),
    (0, common_1.Controller)('reporting'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('reports'),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource,
        vitamina_pulse_service_1.VitaminaPulseService,
        account_access_service_1.AccountAccessService,
        monthly_reports_service_1.MonthlyReportsService])
], ReportingController);
//# sourceMappingURL=reports.controller.js.map