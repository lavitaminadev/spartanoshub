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
const MUESTRA_POR_AVISO = 5;
const CLOSED_STATUSES = [lead_status_enum_1.LeadStatus.WON, lead_status_enum_1.LeadStatus.LOST, lead_status_enum_1.LeadStatus.NO_SHOW];
let CrmHomeService = class CrmHomeService {
    constructor(leads, users) {
        this.leads = leads;
        this.users = users;
    }
    async home(organizationId, coolingDays = 7, alcance = {}) {
        const inicioDeMes = new Date();
        inicioDeMes.setDate(1);
        inicioDeMes.setHours(0, 0, 0, 0);
        const limiteFrio = new Date(Date.now() - coolingDays * 86_400_000);
        const base = {
            organizationId,
            domain: alcance.domain ?? 'commercial',
            ...this.alcanceDeCuentas(alcance),
        };
        const abierto = { ...base, status: (0, typeorm_2.In)(this.openStatuses()) };
        const [delMes, ventasDelMes, montoDelMes, sinContactar, sinAsignar, calificadosSinVisita, equipo] = await Promise.all([
            this.leads.count({ where: this.soloLoSuyo({ ...base, createdAt: (0, typeorm_2.MoreThanOrEqual)(inicioDeMes) }, alcance.onlyAssignedTo) }),
            this.leads.count({ where: this.soloLoSuyo({ ...base, status: lead_status_enum_1.LeadStatus.WON, updatedAt: (0, typeorm_2.MoreThanOrEqual)(inicioDeMes) }, alcance.onlyAssignedTo) }),
            this.montoDelMes({ ...base, onlyAssignedTo: alcance.onlyAssignedTo }, inicioDeMes),
            this.alert('sin_contactar', 'critico', this.soloLoSuyo({ ...abierto, status: lead_status_enum_1.LeadStatus.NEW }, alcance.onlyAssignedTo)),
            this.alert('sin_asignar', 'critico', this.paraCriterio({ ...abierto, assignedTo: (0, typeorm_2.IsNull)() })),
            this.alert('calificados_sin_visita', 'alto', this.soloLoSuyo({
                ...base,
                status: lead_status_enum_1.LeadStatus.QUOTE_SENT,
            }, alcance.onlyAssignedTo)),
            alcance.onlyAssignedTo ? Promise.resolve([]) : this.teamLoad(base, limiteFrio),
        ]);
        const alerts = [sinContactar, sinAsignar, calificadosSinVisita].filter((a) => a.count > 0);
        return {
            month: { leads: delMes, ventas: ventasDelMes, monto: montoDelMes },
            personalScope: Boolean(alcance.onlyAssignedTo),
            urgentCount: alerts
                .filter((a) => a.level === 'critico')
                .reduce((suma, a) => suma + a.count, 0),
            alerts,
            team: equipo,
            coolingDays,
        };
    }
    async montoDelMes(base, desde) {
        const fila = await this.acotar(this.leads.createQueryBuilder('lead'), base)
            .select('COALESCE(SUM(lead.estimated_amount), 0)', 'total')
            .andWhere('lead.status = :status', { status: lead_status_enum_1.LeadStatus.WON })
            .andWhere('lead.updated_at >= :desde', { desde })
            .getRawOne();
        return Number(fila?.total ?? 0);
    }
    acotar(query, base) {
        query
            .where('lead.organization_id = :organizationId', { organizationId: base.organizationId })
            .andWhere('lead.domain = :domain', { domain: base.domain });
        if (base.agencyOnly)
            query.andWhere('lead.client_id IS NULL');
        else if (base.clientId)
            query.andWhere('lead.client_id = :clientId', { clientId: base.clientId });
        const alcanzables = base.clientIds;
        if (alcanzables !== undefined) {
            query.andWhere(alcanzables.length ? 'lead.client_id IN (:...empresas)' : '1 = 0', { empresas: alcanzables });
        }
        if (base.onlyAssignedTo) {
            query.andWhere('(lead.assigned_to = :onlyAssignedTo OR lead.assigned_to IS NULL)', { onlyAssignedTo: base.onlyAssignedTo });
        }
        return query;
    }
    alcanceDeCuentas(alcance) {
        if (alcance.agencyOnly)
            return { agencyOnly: true };
        if (alcance.clientId)
            return { clientId: alcance.clientId };
        if (alcance.allowedClientIds === undefined)
            return {};
        return { clientIds: alcance.allowedClientIds };
    }
    openStatuses() {
        return Object.values(lead_status_enum_1.LeadStatus).filter((s) => !CLOSED_STATUSES.includes(s));
    }
    soloLoSuyo(where, usuarioId) {
        const porColumnas = this.paraCriterio(where);
        if (!usuarioId)
            return porColumnas;
        return [
            { ...porColumnas, assignedTo: usuarioId },
            { ...porColumnas, assignedTo: (0, typeorm_2.IsNull)() },
        ];
    }
    paraCriterio(where) {
        const { clientIds, agencyOnly, ...resto } = where;
        if (agencyOnly)
            return { ...resto, clientId: (0, typeorm_2.IsNull)() };
        if (clientIds === undefined)
            return resto;
        return { ...resto, clientId: (0, typeorm_2.In)(clientIds.length ? clientIds : ['']) };
    }
    async alert(key, nivel, where) {
        const [rows, count] = await this.leads.findAndCount({
            where: where,
            order: { createdAt: 'ASC' },
            take: MUESTRA_POR_AVISO,
            select: { id: true, name: true, source: true, campaignName: true, assignedTo: true, createdAt: true },
        });
        const items = rows.map((lead) => ({
            id: lead.id,
            name: lead.name,
            source: lead.source,
            campaignName: lead.campaignName,
            assignedToName: null,
            createdAt: lead.createdAt,
        }));
        return { key, count, level: nivel, items, sample: items[0] ?? null };
    }
    async teamLoad(base, limiteFrio) {
        const filas = await this.acotar(this.leads.createQueryBuilder('lead'), base)
            .select('lead.assigned_to', 'userId')
            .addSelect('COUNT(*)', 'open')
            .addSelect(`SUM(CASE WHEN lead.status = :nuevo THEN 1 ELSE 0 END)`, 'uncontacted')
            .addSelect(`SUM(CASE WHEN lead.updated_at < :limiteFrio THEN 1 ELSE 0 END)`, 'cooling')
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
