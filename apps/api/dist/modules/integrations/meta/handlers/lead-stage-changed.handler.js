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
var LeadStageChangedHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadStageChangedHandler = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const shared_1 = require("@espartanos/shared");
const meta_conversion_outbox_service_1 = require("../meta-conversion-outbox.service");
const meta_client_pixel_service_1 = require("../meta-client-pixel.service");
const client_capability_service_1 = require("../../../../core/client-scope/client-capability.service");
const lead_entity_1 = require("../../../crm/leads/lead.entity");
const campaign_entity_1 = require("../../../crm/campaigns/campaign.entity");
let LeadStageChangedHandler = LeadStageChangedHandler_1 = class LeadStageChangedHandler {
    constructor(outbox, clientPixels, capacidades, leads, campaigns) {
        this.outbox = outbox;
        this.clientPixels = clientPixels;
        this.capacidades = capacidades;
        this.leads = leads;
        this.campaigns = campaigns;
        this.logger = new common_1.Logger(LeadStageChangedHandler_1.name);
    }
    async handle(payload) {
        try {
            const lead = await this.leads.findOne({
                where: { id: payload.leadId, organizationId: payload.organizationId },
            });
            if (!lead)
                return;
            if (lead.source !== 'meta_lead_ads')
                return;
            const leadId = lead.externalLeadId;
            if (!leadId || !LeadStageChangedHandler_1.LEADGEN_ID.test(leadId)) {
                return;
            }
            if (!payload.clientId)
                return;
            if (!await this.capacidades.tiene(payload.organizationId, payload.clientId, 'metaConversions'))
                return;
            const campana = lead.campaignName
                ? await this.campaigns.findOne({
                    where: { organizationId: payload.organizationId, name: lead.campaignName, clientId: payload.clientId },
                    select: { id: true, metaPixelId: true, metaCapiEnabled: true },
                })
                : null;
            if (campana && campana.metaCapiEnabled === false)
                return;
            const { pixelId, tokenSource } = await this.clientPixels.resolveForScope(payload.organizationId, payload.clientId, campana?.metaPixelId);
            if (!pixelId) {
                this.logger.warn(`Lead ${lead.id}: sin Pixel configurado; no se reporta la etapa "${payload.toStage}"`);
                return;
            }
            if (tokenSource === 'environment') {
                this.logger.warn(`Lead ${lead.id}: el Pixel ${pixelId} no tiene token propio y usará el del entorno; `
                    + 'si Meta lo rechaza, configura el token de esa empresa.');
            }
            await this.outbox.enqueue(payload.organizationId, pixelId, {
                eventName: shared_1.STAGE_LABELS_BY_KEY[payload.toStage] ?? payload.toStage,
                eventTime: Math.floor(Date.now() / 1000),
                actionSource: 'system_generated',
                userData: { lead_id: leadId },
                customData: {
                    leadEventSource: LeadStageChangedHandler_1.ORIGEN,
                    eventSource: 'crm',
                    value: payload.toStage === 'won' && lead.estimatedAmount ? Number(lead.estimatedAmount) : undefined,
                    currency: payload.toStage === 'won' && lead.estimatedAmount ? 'CLP' : undefined,
                },
                eventId: `lead-stage:${lead.id}:${payload.toStage}`,
            });
        }
        catch (error) {
            this.logger.error(`No se pudo reportar la etapa del lead ${payload.leadId}:`, error);
        }
    }
};
exports.LeadStageChangedHandler = LeadStageChangedHandler;
LeadStageChangedHandler.ORIGEN = 'Espartanos';
LeadStageChangedHandler.LEADGEN_ID = /^\d{15,17}$/;
__decorate([
    (0, event_emitter_1.OnEvent)('lead.stage-changed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LeadStageChangedHandler.prototype, "handle", null);
exports.LeadStageChangedHandler = LeadStageChangedHandler = LeadStageChangedHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(4, (0, typeorm_1.InjectRepository)(campaign_entity_1.Campaign)),
    __metadata("design:paramtypes", [meta_conversion_outbox_service_1.MetaConversionOutboxService,
        meta_client_pixel_service_1.MetaClientPixelService,
        client_capability_service_1.ClientCapabilityService,
        typeorm_2.Repository,
        typeorm_2.Repository])
], LeadStageChangedHandler);
