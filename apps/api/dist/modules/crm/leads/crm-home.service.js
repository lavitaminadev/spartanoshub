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
exports.CrmHomeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("./lead.entity");
const lead_status_enum_1 = require("./lead-status.enum");
const user_entity_1 = require("../../users/user.entity");
const CLOSED_STATUSES = [lead_status_enum_1.LeadStatus.WON, lead_status_enum_1.LeadStatus.LOST, lead_status_enum_1.LeadStatus.NO_SHOW];
let CrmHomeService = class CrmHomeService {
    constructor(leads, users) {
        this.leads = leads;
        this.users = users;
    }
    async home(organizationId, coolingDays = 7) {
        const inicioDeMes = new Date();
        inicioDeMes.setDate(1);
        inicioDeMes.setHours(0, 0, 0, 0);
        const limiteFrio = new Date(Date.now() - coolingDays * 86_400_000);
        const abierto = { organizationId, status: (0, typeorm_2.In)(this.openStatuses()) };
        const [delMes, ventasDelMes, montoDelMes, sinContactar, sinAsignar, calificadosSinVisita, equipo] = await Promise.all([
            this.leads.count({ where: { organizationId, createdAt: (0, typeorm_2.MoreThanOrEqual)(inicioDeMes) } }),
            this.leads.count({ where: { organizationId, status: lead_status_enum_1.LeadStatus.WON, updatedAt: (0, typeorm_2.MoreThanOrEqual)(inicioDeMes) } }),
            this.montoDelMes(organizationId, inicioDeMes),
            this.alert('sin_contactar', { ...abierto, status: lead_status_enum_1.LeadStatus.NEW }),
            this.alert('sin_asignar', { ...abierto, assignedTo: (0, typeorm_2.IsNull)() }),
            this.alert('calificados_sin_visita', {
                organizationId,
                status: lead_status_enum_1.LeadStatus.QUOTE_SENT,
            }),
            this.teamLoad(organizationId, limiteFrio),
        ]);
        const alerts = [sinContactar, sinAsignar, calificadosSinVisita].filter((a) => a.count > 0);
        return {
            month: { leads: delMes, ventas: ventasDelMes, monto: montoDelMes },
            urgentCount: alerts.length,
            alerts,
            team: equipo,
            coolingDays,
        };
    }
    async montoDelMes(organizationId, desde) {
        const fila = await this.leads.createQueryBuilder('lead')
            .select('COALESCE(SUM(lead.estimated_amount), 0)', 'total')
            .where('lead.organization_id = :organizationId', { organizationId })
            .andWhere('lead.status = :status', { status: lead_status_enum_1.LeadStatus.WON })
            .andWhere('lead.updated_at >= :desde', { desde })
            .getRawOne();
        return Number(fila?.total ?? 0);
    }
    openStatuses() {
        return Object.values(lead_status_enum_1.LeadStatus).filter((s) => !CLOSED_STATUSES.includes(s));
    }
    async alert(key, where) {
        const [rows, count] = await this.leads.findAndCount({
            where: where,
            order: { createdAt: 'ASC' },
            take: 1,
            select: { id: true, name: true, source: true, campaignName: true, assignedTo: true, createdAt: true },
        });
        const lead = rows[0];
        return {
            key,
            count,
            sample: lead
                ? {
                    id: lead.id,
                    name: lead.name,
                    source: lead.source,
                    campaignName: lead.campaignName,
                    assignedToName: null,
                    createdAt: lead.createdAt,
                }
                : null,
        };
    }
    async teamLoad(organizationId, limiteFrio) {
        const filas = await this.leads.createQueryBuilder('lead')
            .select('lead.assigned_to', 'userId')
            .addSelect('COUNT(*)', 'open')
            .addSelect(`SUM(CASE WHEN lead.status = :nuevo THEN 1 ELSE 0 END)`, 'uncontacted')
            .addSelect(`SUM(CASE WHEN lead.updated_at < :limiteFrio THEN 1 ELSE 0 END)`, 'cooling')
            .where('lead.organization_id = :organizationId', { organizationId })
            .andWhere('lead.assigned_to IS NOT NULL')
            .andWhere('lead.status NOT IN (:...cerrados)', { cerrados: CLOSED_STATUSES })
            .setParameters({ nuevo: lead_status_enum_1.LeadStatus.NEW, limiteFrio })
            .groupBy('lead.assigned_to')
            .getRawMany();
        if (filas.length === 0)
            return [];
        const personas = await this.users.find({
            where: { id: (0, typeorm_2.In)(filas.map((f) => f.userId)) },
            select: { id: true, name: true },
        });
        const nombre = new Map(personas.map((p) => [p.id, p.name]));
        return filas
            .map((f) => ({
            userId: f.userId,
            name: nombre.get(f.userId) ?? 'Sin nombre',
            open: Number(f.open),
            uncontacted: Number(f.uncontacted),
            cooling: Number(f.cooling),
        }))
            .sort((a, b) => b.open - a.open);
    }
};
exports.CrmHomeService = CrmHomeService;
exports.CrmHomeService = CrmHomeService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], CrmHomeService);
