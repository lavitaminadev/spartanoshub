"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const typeorm_1 = require("@nestjs/typeorm");
const meta_controller_1 = require("./meta.controller");
const meta_service_1 = require("./meta.service");
const meta_pixel_service_1 = require("./meta-pixel.service");
const meta_conversions_service_1 = require("./meta-conversions.service");
const meta_pixel_controller_1 = require("./meta-pixel.controller");
const meta_oauth_service_1 = require("./meta-oauth.service");
const meta_integration_accessor_service_1 = require("./meta-integration-accessor.service");
const meta_asset_discovery_service_1 = require("./meta-asset-discovery.service");
const integration_entity_1 = require("../integration.entity");
const integration_account_entity_1 = require("../integration-account.entity");
const crm_module_1 = require("../../crm/crm.module");
const meta_lead_ads_service_1 = require("./meta-lead-ads.service");
const meta_lead_webhook_event_entity_1 = require("./meta-lead-webhook-event.entity");
const campaign_entity_1 = require("../../crm/campaigns/campaign.entity");
const lead_converted_handler_1 = require("./handlers/lead-converted.handler");
const lead_entity_1 = require("../../crm/leads/lead.entity");
const client_entity_1 = require("../../clients/client.entity");
const meta_conversion_outbox_entity_1 = require("./meta-conversion-outbox.entity");
const meta_conversion_outbox_service_1 = require("./meta-conversion-outbox.service");
const integration_metric_entity_1 = require("../integration-metric.entity");
const meta_insights_service_1 = require("./meta-insights.service");
const meta_client_pixel_service_1 = require("./meta-client-pixel.service");
let MetaModule = class MetaModule {
};
exports.MetaModule = MetaModule;
exports.MetaModule = MetaModule = __decorate([
    (0, common_1.Module)({
        imports: [axios_1.HttpModule, crm_module_1.CrmModule, typeorm_1.TypeOrmModule.forFeature([integration_entity_1.Integration, integration_account_entity_1.IntegrationAccount, integration_metric_entity_1.IntegrationMetric, meta_lead_webhook_event_entity_1.MetaLeadWebhookEvent, meta_conversion_outbox_entity_1.MetaConversionOutbox, lead_entity_1.Lead, client_entity_1.Client, campaign_entity_1.Campaign])],
        controllers: [meta_controller_1.MetaController, meta_pixel_controller_1.MetaPixelController],
        providers: [meta_service_1.MetaService, meta_pixel_service_1.MetaPixelService, meta_client_pixel_service_1.MetaClientPixelService, meta_conversions_service_1.MetaConversionsService, meta_conversion_outbox_service_1.MetaConversionOutboxService, meta_insights_service_1.MetaInsightsService, meta_integration_accessor_service_1.MetaIntegrationAccessor, meta_asset_discovery_service_1.MetaAssetDiscoveryService, meta_oauth_service_1.MetaOAuthService, meta_lead_ads_service_1.MetaLeadAdsService, lead_converted_handler_1.LeadConvertedHandler],
        exports: [meta_service_1.MetaService, meta_pixel_service_1.MetaPixelService, meta_client_pixel_service_1.MetaClientPixelService, meta_conversions_service_1.MetaConversionsService, meta_conversion_outbox_service_1.MetaConversionOutboxService, meta_oauth_service_1.MetaOAuthService, meta_asset_discovery_service_1.MetaAssetDiscoveryService, meta_lead_ads_service_1.MetaLeadAdsService],
    })
], MetaModule);
