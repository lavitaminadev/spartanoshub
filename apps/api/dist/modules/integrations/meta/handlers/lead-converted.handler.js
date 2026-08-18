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
var LeadConvertedHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadConvertedHandler = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const meta_conversion_outbox_service_1 = require("../meta-conversion-outbox.service");
const meta_client_pixel_service_1 = require("../meta-client-pixel.service");
const integration_account_entity_1 = require("../../integration-account.entity");
const integration_account_type_enum_1 = require("../../integration-account-type.enum");
const lead_entity_1 = require("../../../crm/leads/lead.entity");
const client_entity_1 = require("../../../clients/client.entity");
let LeadConvertedHandler = LeadConvertedHandler_1 = class LeadConvertedHandler {
    constructor(outbox, clientPixels, accountsRepo, leadRepo, clientRepo) {
        this.outbox = outbox;
        this.clientPixels = clientPixels;
        this.accountsRepo = accountsRepo;
        this.leadRepo = leadRepo;
        this.clientRepo = clientRepo;
        this.logger = new common_1.Logger(LeadConvertedHandler_1.name);
    }
    async handleLeadConvertedEvent(payload) {
        try {
            const lead = await this.leadRepo.findOne({ where: { id: payload.leadId, organizationId: payload.organizationId } });
            if (!lead || !lead.email && !lead.phone)
                return;
            if (lead.source !== 'meta_lead_ads' && !lead.metadata?.adId)
                return;
            const pageId = lead.pageId;
            if (!pageId)
                return;
            const pageAccount = await this.accountsRepo.findOne({
                where: {
                    accountType: integration_account_type_enum_1.IntegrationAccountType.PAGE,
                    externalId: pageId,
                    integration: { organizationId: lead.organizationId },
                },
                relations: { integration: true },
            });
            if (!pageAccount?.integration)
                return;
            const { pixelId } = await this.clientPixels.resolve(lead.organizationId, payload.clientId);
            if (!pixelId) {
                this.logger.warn(`Lead ${lead.id}: el cliente ${payload.clientId} no tiene Pixel configurado; no se encola la conversión`);
                return;
            }
            const client = await this.clientRepo.findOne({ where: { id: payload.clientId, organizationId: lead.organizationId } });
            const eventId = `lead-converted:${lead.id}:${payload.clientId}`;
            const attribution = (lead.metadata?.attribution ?? {});
            await this.outbox.enqueue(lead.organizationId, pixelId, {
                eventName: 'QualifiedLead',
                eventTime: Math.floor(Date.now() / 1000),
                actionSource: 'system_generated',
                userData: {
                    em: lead.email ? [lead.email] : undefined,
                    ph: lead.phone ? [lead.phone] : undefined,
                    externalId: [lead.id],
                    fbp: attribution.fbp,
                    fbc: attribution.fbc,
                    client_ip_address: attribution.clientIpAddress,
                    client_user_agent: attribution.clientUserAgent,
                },
                customData: {
                    currency: 'CLP',
                    value: client?.retainerAmount ? Number(client.retainerAmount) : undefined,
                },
                eventId,
            });
            this.logger.log(`CAPI event queued for Lead ${lead.id}`);
        }
        catch (error) {
            this.logger.error(`Error sending CAPI event for Lead ${payload.leadId}:`, error);
        }
    }
};
exports.LeadConvertedHandler = LeadConvertedHandler;
__decorate([
    (0, event_emitter_1.OnEvent)('lead.converted'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LeadConvertedHandler.prototype, "handleLeadConvertedEvent", null);
exports.LeadConvertedHandler = LeadConvertedHandler = LeadConvertedHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(integration_account_entity_1.IntegrationAccount)),
    __param(3, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(4, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [meta_conversion_outbox_service_1.MetaConversionOutboxService,
        meta_client_pixel_service_1.MetaClientPixelService,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], LeadConvertedHandler);
