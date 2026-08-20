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
exports.CrmDashboardService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("./lead.entity");
const lead_status_enum_1 = require("./lead-status.enum");
let CrmDashboardService = class CrmDashboardService {
    constructor(leads) {
        this.leads = leads;
    }
    async dashboard(organizationId, days) {
        const desde = new Date(Date.now() - days * 86_400_000);
        const base = { organizationId, domain: 'commercial' };
        const [total, calificados, conVisita, ventas, porEtapa, porFuente, porDia, motivos] = await Promise.all([
            this.leads.count({ where: { ...base } }),
            this.leads.count({ where: { ...base, status: lead_status_enum_1.LeadStatus.QUOTE_SENT } }),
            this.leads.count({ where: { ...base, status: lead_status_enum_1.LeadStatus.MEETING_SCHEDULED } }),
            this.leads.count({ where: { ...base, status: lead_status_enum_1.LeadStatus.WON } }),
            this.agrupar(organizationId, 'status'),
            this.agrupar(organizationId, 'source'),
            this.porDia(organizationId, desde),
            this.agrupar(organizationId, 'discard_reason', lead_status_enum_1.LeadStatus.LOST),
        ]);
        const [montoVendido, pipelineAbierto, estancados] = await Promise.all([
            this.sumar(organizationId, lead_status_enum_1.LeadStatus.WON),
            this.sumarAbiertos(organizationId),
            this.leads.count({
                where: {
                    ...base,
                    status: (0, typeorm_2.In)([lead_status_enum_1.LeadStatus.CONTACTED, lead_status_enum_1.LeadStatus.QUOTE_SENT, lead_status_enum_1.LeadStatus.NEGOTIATION]),
                    updatedAt: (0, typeorm_2.LessThan)(new Date(Date.now() - 7 * 86_400_000)),
                },
            }),
        ]);
        return {
            days,
            totals: {
                leads: total,
                calificados,
                conVisita,
                ventas,
                montoVendido,
                pipelineAbierto,
                ticketPromedio: ventas > 0 ? Math.round(montoVendido / ventas) : 0,
                estancados,
            },
            porEtapa,
            porFuente,
            porDia,
            motivosDeCierre: motivos,
        };
    }
    async sumar(organizationId, status) {
        const fila = await this.leads.createQueryBuilder('lead')
            .select('COALESCE(SUM(lead.estimated_amount), 0)', 'total')
            .where('lead.organization_id = :organizationId', { organizationId })
            .andWhere('lead.domain = :domain', { domain: 'commercial' })
            .andWhere('lead.status = :status', { status })
            .getRawOne();
        return Number(fila?.total ?? 0);
    }
    async sumarAbiertos(organizationId) {
        const fila = await this.leads.createQueryBuilder('lead')
            .select('COALESCE(SUM(lead.estimated_amount), 0)', 'total')
            .where('lead.organization_id = :organizationId', { organizationId })
            .andWhere('lead.domain = :domain', { domain: 'commercial' })
            .andWhere('lead.status NOT IN (:...cerrados)', { cerrados: [lead_status_enum_1.LeadStatus.WON, lead_status_enum_1.LeadStatus.LOST] })
            .getRawOne();
        return Number(fila?.total ?? 0);
    }
    async agrupar(organizationId, columna, status) {
        const query = this.leads.createQueryBuilder('lead')
            .select(`lead.${columna}`, 'key')
            .addSelect('COUNT(*)', 'total')
            .where('lead.organization_id = :organizationId', { organizationId })
            .andWhere('lead.domain = :domain', { domain: 'commercial' })
            .groupBy(`lead.${columna}`);
        if (status)
            query.andWhere('lead.status = :status', { status });
        const filas = await query.getRawMany();
        return filas
            .filter((fila) => fila.key)
            .map((fila) => ({ key: fila.key, total: Number(fila.total) }))
            .sort((a, b) => b.total - a.total);
    }
    async porDia(organizationId, desde) {
        const filas = await this.leads.createQueryBuilder('lead')
            .select('DATE(lead.created_at)', 'key')
            .addSelect('COUNT(*)', 'total')
            .where('lead.organization_id = :organizationId', { organizationId })
            .andWhere('lead.domain = :domain', { domain: 'commercial' })
            .andWhere('lead.created_at >= :desde', { desde })
            .groupBy('DATE(lead.created_at)')
            .orderBy('DATE(lead.created_at)', 'ASC')
            .getRawMany();
        return filas.map((fila) => ({ key: String(fila.key), total: Number(fila.total) }));
    }
};
exports.CrmDashboardService = CrmDashboardService;
exports.CrmDashboardService = CrmDashboardService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], CrmDashboardService);
