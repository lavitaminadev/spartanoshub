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
const metricas_del_periodo_1 = require("./metricas-del-periodo");
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
    async explorar(organizationId, clientId, desde, hasta, comparar, allowedClientIds) {
        if (allowedClientIds !== undefined && !allowedClientIds.includes(clientId)) {
            throw new common_1.NotFoundException('Cliente no encontrado');
        }
        const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Cliente no encontrado');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta)) {
            throw new common_1.BadRequestException('Las fechas van en formato AAAA-MM-DD');
        }
        if (hasta <= desde)
            throw new common_1.BadRequestException('El fin del rango debe ser posterior al inicio');
        const referencia = (0, metricas_del_periodo_1.rangoDeComparacion)(desde, hasta, comparar);
        const [periodo, previo] = await Promise.all([
            (0, metricas_del_periodo_1.metricasDelPeriodo)(this.dataSource, organizationId, clientId, desde, hasta),
            referencia ? (0, metricas_del_periodo_1.metricasDelPeriodo)(this.dataSource, organizationId, clientId, referencia.desde, referencia.hasta) : Promise.resolve(null),
        ]);
        return { clientId, clientName: client.name, comparar, periodo, comparacion: previo };
    }
    async generate(organizationId, userId, dto) {
        const client = await this.clients.findOne({ where: { id: dto.clientId, organizationId } });
        if (!client)
            throw new common_1.NotFoundException('Cliente no encontrado');
        const existing = await this.reports.findOne({ where: { organizationId, clientId: dto.clientId, year: dto.year, month: dto.month } });
        if (existing?.status === 'published')
            throw new common_1.BadRequestException('El reporte publicado debe volver a borrador antes de regenerarse');
        const { desde, hasta } = (0, metricas_del_periodo_1.rangoDelMes)(dto.year, dto.month);
        const anterior = (0, metricas_del_periodo_1.rangoDeComparacion)(desde, hasta, 'anterior');
        const [periodo, previo] = await Promise.all([
            (0, metricas_del_periodo_1.metricasDelPeriodo)(this.dataSource, organizationId, dto.clientId, desde, hasta),
            (0, metricas_del_periodo_1.metricasDelPeriodo)(this.dataSource, organizationId, dto.clientId, anterior.desde, anterior.hasta),
        ]);
        const metrics = periodo.metricas;
        const report = existing ?? this.reports.create({ organizationId, clientId: client.id, year: dto.year, month: dto.month, createdBy: userId });
        Object.assign(report, {
            title: `Resultados ${client.name} · ${String(dto.month).padStart(2, '0')}/${dto.year}`,
            status: 'draft', metrics, adSpend: periodo.inversion, leads: metrics.leads, bookings: metrics.bookings, conversions: metrics.conversions,
            salesGenerated: periodo.ventas,
            metricsPrevious: previo.metricas,
            previousPeriodStart: previo.desde,
            executiveSummary: report.executiveSummary || `Durante el período se registraron ${metrics.leads} leads, ${metrics.bookings} reservas y ${metrics.conversions} conversiones atribuidas.`,
            insights: report.insights ?? [],
        });
        return this.reports.save(report);
    }
    async update(id, organizationId, dto, allowedClientIds) {
        const report = await this.find(id, organizationId, allowedClientIds);
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
    async find(id, organizationId, allowedClientIds) {
        const report = await this.reports.findOne({ where: { id, organizationId } });
        if (!report)
            throw new common_1.NotFoundException('Reporte mensual no encontrado');
        if (allowedClientIds !== undefined && !allowedClientIds.includes(report.clientId)) {
            throw new common_1.NotFoundException('Reporte mensual no encontrado');
        }
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
