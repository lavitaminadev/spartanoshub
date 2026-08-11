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
exports.MonthlyReportsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const client_entity_1 = require("../clients/client.entity");
const monthly_report_entity_1 = require("./monthly-report.entity");
let MonthlyReportsService = class MonthlyReportsService {
    constructor(reports, clients, dataSource) {
        this.reports = reports;
        this.clients = clients;
        this.dataSource = dataSource;
    }
    async list(organizationId, options) {
        const where = { organizationId };
        if (options.clientId)
            where.clientId = options.clientId;
        else if (options.clientIds !== undefined)
            where.clientId = (0, typeorm_2.In)(options.clientIds.length ? options.clientIds : ['00000000-0000-0000-0000-000000000000']);
        if (options.clientView)
            where.status = 'published';
        if (options.year)
            where.year = options.year;
        if (options.month)
            where.month = options.month;
        const reports = await this.reports.find({ where, order: { year: 'DESC', month: 'DESC' } });
        const clientIds = [...new Set(reports.map((report) => report.clientId))];
        const clients = clientIds.length ? await this.clients.find({ where: { organizationId, id: (0, typeorm_2.In)(clientIds) } }) : [];
        const clientMap = new Map(clients.map((client) => [client.id, client.name]));
        return reports.map((report) => ({ ...report, clientName: clientMap.get(report.clientId) ?? 'Cliente' }));
    }
    async generate(organizationId, userId, dto) {
        const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Cliente no encontrado');
        const existing = await this.reports.findOne({ where: { clientId: dto.clientId, year: dto.year, month: dto.month } });
        if (existing?.status === 'published')
            throw new common_1.BadRequestException('El reporte publicado debe volver a borrador antes de regenerarse');
        const start = `${dto.year}-${String(dto.month).padStart(2, '0')}-01`;
        const endDate = new Date(dto.year, dto.month, 1);
        const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;
        const params = [organizationId, dto.clientId, start, end];
        const [[ads], [bookings], [production], [meetings], [sales]] = await Promise.all([
            this.dataSource.query('SELECT COALESCE(SUM(spend),0) spend, COALESCE(SUM(impressions),0) impressions, COALESCE(SUM(clicks),0) clicks, COALESCE(SUM(leads),0) leads, COALESCE(SUM(conversions),0) conversions FROM integration_metrics WHERE organization_id = ? AND client_id = ? AND metric_date >= ? AND metric_date < ?', params),
            this.dataSource.query("SELECT COUNT(*) total, SUM(CASE WHEN status = 'attended' THEN 1 ELSE 0 END) attended, SUM(CASE WHEN status = 'no_show' THEN 1 ELSE 0 END) noShow FROM reservations WHERE organization_id = ? AND client_id = ? AND starts_at >= ? AND starts_at < ?", params),
            this.dataSource.query("SELECT COUNT(*) delivered, COALESCE(SUM(ud_amount),0) ud FROM pieces WHERE organization_id = ? AND client_id = ? AND delivered_at >= ? AND delivered_at < ? AND status = 'delivered'", params),
            this.dataSource.query("SELECT COUNT(*) total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) completed FROM meetings WHERE organization_id = ? AND client_id = ? AND scheduled_at >= ? AND scheduled_at < ?", params),
            this.dataSource.query("SELECT COALESCE(SUM(amount),0) total, COUNT(*) count FROM crm_opportunities WHERE organization_id = ? AND client_id = ? AND stage IN ('won','closed_won') AND updated_at >= ? AND updated_at < ?", params),
        ]);
        const metrics = {
            impressions: Number(ads?.impressions ?? 0), clicks: Number(ads?.clicks ?? 0), leads: Number(ads?.leads ?? 0), conversions: Number(ads?.conversions ?? 0),
            bookings: Number(bookings?.total ?? 0), attendedBookings: Number(bookings?.attended ?? 0), noShows: Number(bookings?.noShow ?? 0),
            deliveredPieces: Number(production?.delivered ?? 0), consumedUd: Number(production?.ud ?? 0), meetings: Number(meetings?.total ?? 0), completedMeetings: Number(meetings?.completed ?? 0), wonOpportunities: Number(sales?.count ?? 0),
        };
        const report = existing ?? this.reports.create({ organizationId, clientId: client.id, year: dto.year, month: dto.month, createdBy: userId });
        Object.assign(report, {
            title: `Resultados ${client.name} · ${String(dto.month).padStart(2, '0')}/${dto.year}`,
            status: 'draft', metrics, adSpend: Number(ads?.spend ?? 0), leads: metrics.leads, bookings: metrics.bookings, conversions: metrics.conversions,
            salesGenerated: Number(sales?.total ?? 0),
            executiveSummary: report.executiveSummary || `Durante el período se registraron ${metrics.leads} leads, ${metrics.bookings} reservas y ${metrics.conversions} conversiones atribuidas.`,
            insights: report.insights ?? [],
        });
        return this.reports.save(report);
    }
    async update(id, organizationId, dto) {
        const report = await this.find(id, organizationId);
        if (report.status === 'published')
            throw new common_1.BadRequestException('Devuelve el reporte a borrador antes de editarlo');
        Object.assign(report, dto);
        if (dto.title !== undefined)
            report.title = dto.title.trim();
        if (dto.executiveSummary !== undefined)
            report.executiveSummary = dto.executiveSummary.trim() || undefined;
        if (dto.recommendations !== undefined)
            report.recommendations = dto.recommendations.trim() || undefined;
        if (dto.insights !== undefined)
            report.insights = dto.insights.map((value) => value.trim()).filter(Boolean);
        return this.reports.save(report);
    }
    async setPublished(id, organizationId, userId, published) {
        const report = await this.find(id, organizationId);
        report.status = published ? 'published' : 'draft';
        report.publishedAt = published ? new Date() : undefined;
        report.publishedBy = published ? userId : undefined;
        await this.dataSource.query('UPDATE account_cycles SET report_status = ? WHERE organization_id = ? AND client_id = ? AND year = ? AND month = ?', [published ? 'completed' : 'in_progress', organizationId, report.clientId, report.year, report.month]);
        return this.reports.save(report);
    }
    async find(id, organizationId) {
        const report = await this.reports.findOne({ where: { id, organizationId } });
        if (!report)
            throw new common_1.NotFoundException('Reporte mensual no encontrado');
        return report;
    }
};
exports.MonthlyReportsService = MonthlyReportsService;
exports.MonthlyReportsService = MonthlyReportsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(monthly_report_entity_1.MonthlyReport)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(2, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource])
], MonthlyReportsService);
//# sourceMappingURL=monthly-reports.service.js.map