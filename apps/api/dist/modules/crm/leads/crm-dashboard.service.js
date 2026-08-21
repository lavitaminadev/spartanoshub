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
exports.CrmDashboardService = exports.TASA_COMISION = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("./lead.entity");
const lead_status_enum_1 = require("./lead-status.enum");
exports.TASA_COMISION = 0.02;
let CrmDashboardService = class CrmDashboardService {
    constructor(leads) {
        this.leads = leads;
    }
    async dashboard(organizationId, days, alcance = {}) {
        const desde = new Date(Date.now() - days * 86_400_000);
        const domain = alcance.domain ?? 'commercial';
        const base = {
            organizationId,
            domain,
            ...(alcance.clientId ? { clientId: alcance.clientId } : {}),
        };
        const [total, calificados, conVisita, ventas, porEtapa, porFuente, porDia, motivos] = await Promise.all([
            this.leads.count({ where: { ...base } }),
            this.leads.count({ where: { ...base, status: lead_status_enum_1.LeadStatus.QUOTE_SENT } }),
            this.leads.count({ where: { ...base, status: lead_status_enum_1.LeadStatus.MEETING_SCHEDULED } }),
            this.leads.count({ where: { ...base, status: lead_status_enum_1.LeadStatus.WON } }),
            this.agrupar(base, 'status'),
            this.agrupar(base, 'source'),
            this.porDia(base, desde),
            this.agrupar(base, 'discard_reason', lead_status_enum_1.LeadStatus.LOST),
        ]);
        const [montoVendido, pipelineAbierto, estancados] = await Promise.all([
            this.sumar(base, lead_status_enum_1.LeadStatus.WON),
            this.sumarAbiertos(base),
            this.leads.count({
                where: {
                    ...base,
                    status: (0, typeorm_2.In)([lead_status_enum_1.LeadStatus.CONTACTED, lead_status_enum_1.LeadStatus.QUOTE_SENT, lead_status_enum_1.LeadStatus.NEGOTIATION]),
                    updatedAt: (0, typeorm_2.LessThan)(new Date(Date.now() - 7 * 86_400_000)),
                },
            }),
        ]);
        const [tiempoDeCierre, conversionPorSetter] = await Promise.all([
            this.tiempoDeCierre(base),
            this.conversionPorSetter(base),
        ]);
        const mejorSetter = conversionPorSetter
            .filter((fila) => fila.leads >= 3)
            .sort((a, b) => b.conversion - a.conversion)[0] ?? null;
        return {
            days,
            domain,
            clientId: alcance.clientId ?? null,
            tiempoDeCierre,
            mejorSetter,
            comision: {
                tasa: exports.TASA_COMISION,
                ganada: Math.round(montoVendido * exports.TASA_COMISION),
                proyectada: Math.round(pipelineAbierto * exports.TASA_COMISION),
            },
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
    async sumar(base, status) {
        const fila = await this.acotar(this.leads.createQueryBuilder('lead'), base)
            .select('COALESCE(SUM(lead.estimated_amount), 0)', 'total')
            .andWhere('lead.status = :status', { status })
            .getRawOne();
        return Number(fila?.total ?? 0);
    }
    async tiempoDeCierre(base) {
        const vendidos = await this.leads.find({
            where: { ...base, status: lead_status_enum_1.LeadStatus.WON },
            select: { createdAt: true, updatedAt: true },
        });
        if (!vendidos.length)
            return null;
        const dias = vendidos.map((lead) => {
            const entrada = new Date(lead.createdAt).getTime();
            const cierre = new Date(lead.updatedAt).getTime();
            return Math.max(0, (cierre - entrada) / 86_400_000);
        });
        return Math.round(dias.reduce((suma, valor) => suma + valor, 0) / dias.length);
    }
    async conversionPorSetter(base) {
        const filas = await this.leads.createQueryBuilder('lead')
            .select('lead.assigned_to', 'assignedTo')
            .addSelect('COUNT(*)', 'leads')
            .addSelect(`SUM(CASE WHEN lead.status = '${lead_status_enum_1.LeadStatus.WON}' THEN 1 ELSE 0 END)`, 'ventas')
            .where('lead.organization_id = :organizationId', { organizationId: base.organizationId })
            .andWhere('lead.domain = :domain', { domain: base.domain })
            .andWhere(base.clientId ? 'lead.client_id = :clientId' : '1 = 1', { clientId: base.clientId })
            .andWhere('lead.assigned_to IS NOT NULL')
            .groupBy('lead.assigned_to')
            .getRawMany();
        return filas.map((fila) => {
            const leads = Number(fila.leads) || 0;
            const ventas = Number(fila.ventas) || 0;
            return { assignedTo: fila.assignedTo, leads, ventas, conversion: leads ? ventas / leads : 0 };
        });
    }
    async sumarAbiertos(base) {
        const fila = await this.acotar(this.leads.createQueryBuilder('lead'), base)
            .select('COALESCE(SUM(lead.estimated_amount), 0)', 'total')
            .andWhere('lead.status NOT IN (:...cerrados)', { cerrados: [lead_status_enum_1.LeadStatus.WON, lead_status_enum_1.LeadStatus.LOST] })
            .getRawOne();
        return Number(fila?.total ?? 0);
    }
    acotar(query, base) {
        query
            .where('lead.organization_id = :organizationId', { organizationId: base.organizationId })
            .andWhere('lead.domain = :domain', { domain: base.domain });
        if (base.clientId)
            query.andWhere('lead.client_id = :clientId', { clientId: base.clientId });
        return query;
    }
    async agrupar(base, columna, status) {
        const query = this.acotar(this.leads.createQueryBuilder('lead'), base)
            .select(`lead.${columna}`, 'key')
            .addSelect('COUNT(*)', 'total')
            .groupBy(`lead.${columna}`);
        if (status)
            query.andWhere('lead.status = :status', { status });
        const filas = await query.getRawMany();
        return filas
            .filter((fila) => fila.key)
            .map((fila) => ({ key: fila.key, total: Number(fila.total) }))
            .sort((a, b) => b.total - a.total);
    }
    async porDia(base, desde) {
        const filas = await this.acotar(this.leads.createQueryBuilder('lead'), base)
            .select('DATE(lead.created_at)', 'key')
            .addSelect('COUNT(*)', 'total')
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
