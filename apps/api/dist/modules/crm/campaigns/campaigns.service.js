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
exports.CampaignsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const campaign_entity_1 = require("./campaign.entity");
const lead_entity_1 = require("../leads/lead.entity");
let CampaignsService = class CampaignsService {
    constructor(campaigns, leads) {
        this.campaigns = campaigns;
        this.leads = leads;
    }
    async list(organizationId, clientId) {
        const campanias = await this.campaigns.find({
            where: { organizationId, clientId: clientId ?? (0, typeorm_2.IsNull)() },
            order: { createdAt: 'DESC' },
        });
        if (!campanias.length)
            return [];
        const conteos = await this.leadsPorCampania(organizationId, campanias.map((c) => c.name));
        return campanias.map((campania) => {
            const leads = conteos.get(campania.name) ?? 0;
            const investment = Number(campania.investment) || 0;
            return {
                id: campania.id,
                name: campania.name,
                source: campania.source,
                clientId: campania.clientId,
                investment,
                status: campania.status,
                startsAt: campania.startsAt,
                endsAt: campania.endsAt,
                leads,
                costPerLead: leads > 0 ? Math.round(investment / leads) : null,
            };
        });
    }
    async create(organizationId, dto) {
        return this.campaigns.save(this.campaigns.create({
            organizationId,
            name: dto.name.trim(),
            source: dto.source ?? 'Meta Ads',
            clientId: dto.clientId ?? null,
            startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
            endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
            investment: dto.investment ?? 0,
            status: dto.status ?? 'active',
        }));
    }
    async update(id, organizationId, dto) {
        const campania = await this.campaigns.findOne({ where: { id, organizationId } });
        if (!campania)
            throw new common_1.NotFoundException('Campaña no encontrada');
        campania.name = dto.name.trim();
        if (dto.source !== undefined)
            campania.source = dto.source;
        if (dto.clientId !== undefined)
            campania.clientId = dto.clientId;
        if (dto.startsAt !== undefined)
            campania.startsAt = dto.startsAt ? new Date(dto.startsAt) : null;
        if (dto.endsAt !== undefined)
            campania.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
        if (dto.investment !== undefined)
            campania.investment = dto.investment;
        if (dto.status !== undefined)
            campania.status = dto.status;
        return this.campaigns.save(campania);
    }
    async remove(id, organizationId) {
        const resultado = await this.campaigns.delete({ id, organizationId });
        if (!resultado.affected)
            throw new common_1.NotFoundException('Campaña no encontrada');
    }
    async leadsPorCampania(organizationId, nombres) {
        const filas = await this.leads.createQueryBuilder('lead')
            .select('lead.campaign_name', 'name')
            .addSelect('COUNT(*)', 'total')
            .where('lead.organization_id = :organizationId', { organizationId })
            .andWhere('lead.campaign_name IN (:...nombres)', { nombres })
            .groupBy('lead.campaign_name')
            .getRawMany();
        return new Map(filas.map((fila) => [fila.name, Number(fila.total) || 0]));
    }
};
exports.CampaignsService = CampaignsService;
exports.CampaignsService = CampaignsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(campaign_entity_1.Campaign)),
    __param(1, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], CampaignsService);
