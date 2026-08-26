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
const ingest_source_entity_1 = require("../leads/ingest-source.entity");
const lead_ingest_service_1 = require("../leads/lead-ingest.service");
let CampaignsService = class CampaignsService {
    constructor(campaigns, leads, sources, ingest) {
        this.campaigns = campaigns;
        this.leads = leads;
        this.sources = sources;
        this.ingest = ingest;
    }
    async list(organizationId, clientId) {
        const campanias = await this.campaigns.find({
            where: { organizationId, clientId: clientId ?? (0, typeorm_2.IsNull)() },
            order: { createdAt: 'DESC' },
        });
        if (!campanias.length)
            return [];
        const conteos = await this.leadsPorCampania(organizationId, campanias.map((c) => c.name), clientId);
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
                metaPixelId: campania.metaPixelId ?? null,
                metaCapiEnabled: campania.metaCapiEnabled,
                leads,
                costPerLead: leads > 0 ? Math.round(investment / leads) : null,
            };
        });
    }
    async findOne(id, organizationId) {
        const campaign = await this.campaigns.findOne({ where: { id, organizationId } });
        if (!campaign)
            throw new common_1.NotFoundException('Campaña no encontrada');
        return campaign;
    }
    async create(organizationId, dto, createdBy) {
        const campaign = await this.campaigns.save(this.campaigns.create({
            organizationId,
            name: dto.name.trim(),
            source: dto.source ?? 'Meta Ads',
            clientId: dto.clientId ?? null,
            metaPixelId: dto.metaPixelId?.trim() || null,
            metaCapiEnabled: dto.metaCapiEnabled ?? true,
            startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
            endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
            investment: dto.investment ?? 0,
            status: dto.status ?? 'active',
        }));
        const { token } = await this.ingest.issueToken(this.sources.create({
            organizationId,
            clientId: campaign.clientId ?? null,
            name: campaign.name,
            source: campaign.source,
            campaignName: campaign.name,
            campaignId: campaign.id,
            isActive: true,
            createdBy: createdBy ?? null,
        }));
        return { campaign, token };
    }
    async update(id, organizationId, dto) {
        const campania = await this.findOne(id, organizationId);
        const source = await this.sources.findOne({
            where: [
                { organizationId, campaignId: campania.id },
                { organizationId, campaignName: campania.name, clientId: campania.clientId ?? (0, typeorm_2.IsNull)() },
            ],
        });
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
        if (dto.metaPixelId !== undefined)
            campania.metaPixelId = dto.metaPixelId?.trim() || null;
        if (dto.metaCapiEnabled !== undefined)
            campania.metaCapiEnabled = dto.metaCapiEnabled;
        const saved = await this.campaigns.save(campania);
        if (source) {
            source.campaignId = saved.id;
            source.campaignName = saved.name;
            source.name = saved.name;
            source.source = saved.source;
            source.clientId = saved.clientId ?? null;
            source.isActive = saved.status === 'active';
            await this.sources.save(source);
        }
        return saved;
    }
    async remove(id, organizationId) {
        const campaign = await this.findOne(id, organizationId);
        const source = await this.sources.findOne({
            where: [
                { organizationId, campaignId: id },
                { organizationId, campaignName: campaign.name, clientId: campaign.clientId ?? (0, typeorm_2.IsNull)() },
            ],
        });
        if (source) {
            source.isActive = false;
            await this.sources.save(source);
        }
        const resultado = await this.campaigns.delete({ id, organizationId });
        if (!resultado.affected)
            throw new common_1.NotFoundException('Campaña no encontrada');
    }
    async leadsPorCampania(organizationId, nombres, clientId) {
        const query = this.leads.createQueryBuilder('lead')
            .select('lead.campaign_name', 'name')
            .addSelect('COUNT(*)', 'total')
            .where('lead.organization_id = :organizationId', { organizationId })
            .andWhere('lead.campaign_name IN (:...nombres)', { nombres });
        if (clientId)
            query.andWhere('lead.client_id = :clientId', { clientId });
        else
            query.andWhere('lead.client_id IS NULL');
        const filas = await query
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
    __param(2, (0, typeorm_1.InjectRepository)(ingest_source_entity_1.LeadIngestSource)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        lead_ingest_service_1.LeadIngestService])
], CampaignsService);
