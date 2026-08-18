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
var GoogleConversionOutboxService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleConversionOutboxService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const outbox_processor_base_1 = require("../../../core/outbox/outbox-processor.base");
const google_conversion_outbox_entity_1 = require("./google-conversion-outbox.entity");
const google_conversions_service_1 = require("./google-conversions.service");
const integration_entity_1 = require("../integration.entity");
const integration_account_entity_1 = require("../integration-account.entity");
const integration_account_type_enum_1 = require("../integration-account-type.enum");
const integration_provider_enum_1 = require("../integration-provider.enum");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
const google_oauth_service_1 = require("./google-oauth.service");
let GoogleConversionOutboxService = GoogleConversionOutboxService_1 = class GoogleConversionOutboxService extends outbox_processor_base_1.OutboxProcessor {
    constructor(repository, integrations, accounts, conversions, oauth) {
        super();
        this.repository = repository;
        this.integrations = integrations;
        this.accounts = accounts;
        this.conversions = conversions;
        this.oauth = oauth;
        this.logger = new common_1.Logger(GoogleConversionOutboxService_1.name);
        this.entity = google_conversion_outbox_entity_1.GoogleConversionOutbox;
        this.label = 'Google Ads';
    }
    async resolveConfig(organizationId, clientId, eventKey) {
        const integration = await this.integrations.findOne({
            where: { organizationId, provider: integration_provider_enum_1.IntegrationProvider.GOOGLE },
        });
        if (!integration)
            return null;
        const accounts = await this.accounts.find({
            where: { integrationId: integration.id, accountType: integration_account_type_enum_1.IntegrationAccountType.AD_ACCOUNT },
        });
        const account = accounts.find((item) => item.metadata?.clientId === clientId) ?? accounts[0];
        if (!account)
            return null;
        const actionId = account.metadata?.conversionActions?.[eventKey];
        if (!actionId)
            return null;
        const customerId = account.externalId.replace(/\D/g, '');
        return {
            customerId,
            conversionAction: `customers/${customerId}/conversionActions/${actionId}`,
        };
    }
    async enqueue(organizationId, config, eventId, conversion) {
        if (!eventId)
            throw new Error('A stable eventId is required for Google Ads conversions');
        const existing = await this.repository.findOne({ where: { organizationId, eventId } });
        if (existing)
            return existing;
        return this.repository.save(this.repository.create({
            organizationId,
            eventId,
            customerId: config.customerId,
            conversionAction: config.conversionAction,
            conversionData: { ...conversion, conversionDateTime: conversion.conversionDateTime.toISOString() },
        }));
    }
    async stats() {
        const countBy = (status) => this.repository.count({ where: status ? { status } : {} });
        const [pending, retry, processing, failed, processed, total] = await Promise.all([
            countBy('pending'),
            countBy('retry'),
            countBy('processing'),
            countBy('failed'),
            countBy('processed'),
            countBy(),
        ]);
        return { pending, retry, processing, failed, processed, total };
    }
    async send(item) {
        const token = await this.resolveAccessToken(item.organizationId);
        if (!token)
            throw new Error('Google integration is not connected');
        const data = item.conversionData;
        await this.conversions.uploadClickConversions(item.customerId, token, [{
                ...data,
                conversionAction: item.conversionAction,
                conversionDateTime: new Date(data.conversionDateTime),
            }]);
    }
    classifyFailure(error) {
        const message = error instanceof Error ? error.message : 'Unknown Google Ads error';
        const isNonRetryable = /INVALID_ARGUMENT|NOT_FOUND|PERMISSION_DENIED|no se requiere|Se requiere un identificador/i.test(message);
        const isExpiredToken = /expired|invalid.*token|unauthorized|UNAUTHENTICATED/i.test(message);
        return {
            retryable: !isNonRetryable && !isExpiredToken,
            tag: isExpiredToken ? '[TOKEN]' : undefined,
        };
    }
    async resolveAccessToken(organizationId) {
        let integration = await this.integrations.findOne({
            where: { organizationId, provider: integration_provider_enum_1.IntegrationProvider.GOOGLE },
        });
        if (!integration)
            return undefined;
        const expiry = typeof integration.config?.expiryDate === 'string' ? Date.parse(integration.config.expiryDate) : Number.NaN;
        if (Number.isFinite(expiry) && expiry <= Date.now() + 60_000) {
            integration = await this.oauth.refreshIntegration(integration.id, organizationId);
        }
        return (0, integration_secrets_1.revealSecret)(typeof integration?.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
    }
};
exports.GoogleConversionOutboxService = GoogleConversionOutboxService;
exports.GoogleConversionOutboxService = GoogleConversionOutboxService = GoogleConversionOutboxService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(google_conversion_outbox_entity_1.GoogleConversionOutbox)),
    __param(1, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __param(2, (0, typeorm_1.InjectRepository)(integration_account_entity_1.IntegrationAccount)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        google_conversions_service_1.GoogleConversionsService,
        google_oauth_service_1.GoogleOAuthService])
], GoogleConversionOutboxService);
