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
exports.MetaOAuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const integration_entity_1 = require("../integration.entity");
const integration_account_entity_1 = require("../integration-account.entity");
const integration_account_type_enum_1 = require("../integration-account-type.enum");
const integration_provider_enum_1 = require("../integration-provider.enum");
const integration_status_enum_1 = require("../integration-status.enum");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
const meta_conversion_outbox_entity_1 = require("./meta-conversion-outbox.entity");
const meta_lead_webhook_event_entity_1 = require("./meta-lead-webhook-event.entity");
const meta_integration_accessor_service_1 = require("./meta-integration-accessor.service");
const meta_asset_discovery_service_1 = require("./meta-asset-discovery.service");
let MetaOAuthService = class MetaOAuthService {
    constructor(integrations, accounts, conversionOutbox, leadEvents, accessor, assets) {
        this.integrations = integrations;
        this.accounts = accounts;
        this.conversionOutbox = conversionOutbox;
        this.leadEvents = leadEvents;
        this.accessor = accessor;
        this.assets = assets;
    }
    getAuthorizationUrl(redirectUri, state) {
        const appId = process.env.META_APP_ID;
        if (!appId || !process.env.META_APP_SECRET) {
            throw new common_1.ServiceUnavailableException('Meta aún no está configurado en el entorno del servidor');
        }
        const scopes = this.getAuthorizationScopes().join(',');
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        return `https://www.facebook.com/${version}/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code&state=${encodeURIComponent(state)}`;
    }
    getAppId() {
        return process.env.META_APP_ID;
    }
    isConfigured() {
        return !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
    }
    async disconnectIntegration(id, organizationId) {
        const integration = await this.integrations.findOne({
            where: { id, organizationId, provider: integration_provider_enum_1.IntegrationProvider.META },
        });
        if (!integration)
            throw new common_1.BadRequestException('Meta integration not found');
        const accounts = await this.accounts.find({ where: { integrationId: id } });
        const pages = accounts.filter((account) => account.accountType === integration_account_type_enum_1.IntegrationAccountType.PAGE && account.metadata?.selected);
        try {
            await this.assets.unsubscribePages(pages);
            const token = this.accessor.getAccessToken(integration);
            if (token) {
                const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
                await fetch(`https://graph.facebook.com/${version}/me/permissions`, {
                    method: 'DELETE',
                    headers: { authorization: `Bearer ${token}` },
                    signal: AbortSignal.timeout(10000),
                });
            }
        }
        catch {
        }
        for (const account of accounts) {
            account.accessToken = null;
            account.refreshToken = null;
            account.tokenExpiresAt = null;
            account.metadata = { ...account.metadata, selected: false };
            await this.accounts.save(account);
        }
        integration.status = integration_status_enum_1.IntegrationStatus.DISABLED;
        integration.config = {};
        integration.errorMessage = undefined;
        return this.integrations.save(integration);
    }
    async connectWithCode(organizationId, code, redirectUri) {
        const shortLived = await this.exchangeCode(code, redirectUri);
        const longLived = await this.exchangeForLongLivedToken(shortLived.access_token);
        const profile = await this.fetchGraph(process.env.META_GRAPH_API_VERSION ?? 'v23.0', '/me', longLived.access_token, { fields: 'id' });
        return this.upsertIntegration(organizationId, {
            config: {
                accessToken: (0, integration_secrets_1.protectSecret)(longLived.access_token),
                metaUserId: profile.id,
                tokenType: longLived.token_type ?? shortLived.token_type,
                expiresIn: longLived.expires_in ?? shortLived.expires_in,
                scopes: this.getAuthorizationScopes(),
                expiresAt: (longLived.expires_in ?? shortLived.expires_in)
                    ? new Date(Date.now() + (longLived.expires_in ?? shortLived.expires_in) * 1000).toISOString()
                    : undefined,
            },
            status: integration_status_enum_1.IntegrationStatus.ACTIVE,
        });
    }
    async refreshIntegration(id, organizationId) {
        const integration = await this.integrations.findOne({
            where: { id, organizationId, provider: integration_provider_enum_1.IntegrationProvider.META },
        });
        if (!integration)
            throw new common_1.BadRequestException('Meta integration not found');
        const currentToken = this.accessor.getAccessToken(integration);
        if (!currentToken)
            throw new common_1.BadRequestException('Meta access token is missing');
        const longLived = await this.exchangeForLongLivedToken(currentToken);
        integration.status = integration_status_enum_1.IntegrationStatus.ACTIVE;
        integration.lastSyncAt = new Date();
        integration.errorMessage = undefined;
        integration.config = {
            ...integration.config,
            accessToken: (0, integration_secrets_1.protectSecret)(longLived.access_token),
            tokenType: longLived.token_type ?? integration.config?.tokenType,
            scopes: integration.config?.scopes ?? this.getAuthorizationScopes(),
            expiresIn: longLived.expires_in,
            expiresAt: longLived.expires_in
                ? new Date(Date.now() + longLived.expires_in * 1000).toISOString()
                : integration.config?.expiresAt,
        };
        return this.integrations.save(integration);
    }
    async getIntegrationHealth(integrationId, organizationId) {
        const integration = await this.accessor.requireIntegration(integrationId, organizationId);
        const assets = await this.assets.getAssets(integrationId, organizationId);
        const expiresAt = typeof integration.config?.expiresAt === 'string' ? integration.config.expiresAt : null;
        const [capiPending, capiFailed, leadEventsProcessed, leadEventsFailed] = await Promise.all([
            this.conversionOutbox.count({ where: [{ organizationId, status: 'pending' }, { organizationId, status: 'retry' }] }),
            this.conversionOutbox.count({ where: { organizationId, status: 'failed' } }),
            this.leadEvents.count({ where: { organizationId, processingStatus: 'processed' } }),
            this.leadEvents.count({ where: { organizationId, processingStatus: 'error' } }),
        ]);
        const webhookBaseUrl = process.env.API_PUBLIC_URL?.replace(/\/$/, '');
        const webhookConfigured = Boolean(process.env.META_APP_SECRET &&
            process.env.META_WEBHOOK_VERIFY_TOKEN &&
            webhookBaseUrl);
        const pixelId = typeof integration.config?.pixelId === 'string' ? integration.config.pixelId : null;
        const selectedCount = assets.pages.filter((asset) => asset.selected).length +
            assets.instagramProfiles.filter((asset) => asset.selected).length +
            assets.adAccounts.filter((asset) => asset.selected).length;
        return {
            connected: integration.status === integration_status_enum_1.IntegrationStatus.ACTIVE,
            tokenExpiresAt: expiresAt,
            selectedAssets: selectedCount,
            scopes: Array.isArray(integration.config?.scopes) ? integration.config.scopes : [],
            leadCaptureReady: webhookConfigured &&
                Array.isArray(integration.config?.selectedPageIds) &&
                integration.config.selectedPageIds.length > 0 &&
                Array.isArray(integration.config?.scopes) &&
                integration.config.scopes.includes('leads_retrieval') &&
                integration.config.scopes.includes('pages_manage_metadata'),
            credentialsEncrypted: typeof integration.config?.accessToken === 'string' &&
                integration.config.accessToken.startsWith('enc:v1:'),
            pixelId,
            conversionsTokenSource: process.env.META_CONVERSIONS_ACCESS_TOKEN ? 'dedicated' : 'oauth',
            webhookConfigured,
            webhookUrl: webhookBaseUrl ? `${webhookBaseUrl}/webhooks/meta` : null,
            capiConfigured: Boolean(pixelId && (process.env.META_CONVERSIONS_ACCESS_TOKEN || integration.config?.accessToken)),
            capiPending,
            capiFailed,
            leadEventsProcessed,
            leadEventsFailed,
        };
    }
    async getSecureAccessToken(integrationId, organizationId) {
        return this.accessor.getAccessToken(await this.accessor.requireIntegration(integrationId, organizationId));
    }
    async savePixelId(integrationId, organizationId, pixelId) {
        const integration = await this.accessor.requireIntegration(integrationId, organizationId);
        integration.config = { ...integration.config, pixelId };
        integration.lastSyncAt = new Date();
        await this.integrations.save(integration);
    }
    async getPixelId(integrationId, organizationId) {
        const integration = await this.accessor.requireIntegration(integrationId, organizationId);
        return typeof integration.config?.pixelId === 'string' ? integration.config.pixelId : null;
    }
    async handleDataDeletion(metaUserId) {
        const candidates = await this.integrations.find({
            where: { provider: integration_provider_enum_1.IntegrationProvider.META },
        });
        const integration = candidates.find((item) => item.config?.metaUserId === metaUserId);
        if (!integration)
            return;
        await this.accounts.delete({ integrationId: integration.id });
        const { accessToken: _accessToken, metaUserId: _metaUserId, clientPixels: _clientPixels, ...retainedConfig } = integration.config ?? {};
        integration.config = {
            ...retainedConfig,
            dataDeletedAt: new Date().toISOString(),
        };
        integration.status = integration_status_enum_1.IntegrationStatus.DISABLED;
        integration.errorMessage = 'Meta data deletion request completed';
        await this.integrations.save(integration);
    }
    getAuthorizationScopes() {
        return [
            'ads_read',
            'leads_retrieval',
            'pages_show_list',
            'instagram_basic',
            'instagram_manage_messages',
            'pages_messaging',
            'pages_manage_metadata',
            'pages_read_engagement',
            'business_management',
        ];
    }
    async exchangeCode(code, redirectUri) {
        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        if (!appId || !appSecret)
            throw new common_1.BadRequestException('Meta OAuth is not configured');
        const params = new URLSearchParams({
            client_id: appId,
            client_secret: appSecret,
            redirect_uri: redirectUri,
            code,
        });
        const response = await fetch(`https://graph.facebook.com/${version}/oauth/access_token?${params.toString()}`, { signal: AbortSignal.timeout(25000) });
        const data = await response.json();
        if (!response.ok) {
            throw new common_1.BadRequestException('Meta OAuth token exchange failed');
        }
        return data;
    }
    async exchangeForLongLivedToken(accessToken) {
        const appId = process.env.META_APP_ID;
        const appSecret = process.env.META_APP_SECRET;
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        if (!appId || !appSecret)
            throw new common_1.BadRequestException('Meta OAuth is not configured');
        const params = new URLSearchParams({
            grant_type: 'fb_exchange_token',
            client_id: appId,
            client_secret: appSecret,
            fb_exchange_token: accessToken,
        });
        const response = await fetch(`https://graph.facebook.com/${version}/oauth/access_token?${params.toString()}`, { signal: AbortSignal.timeout(25000) });
        const data = await response.json();
        if (!response.ok) {
            throw new common_1.BadRequestException('Meta token refresh failed');
        }
        return data;
    }
    async upsertIntegration(organizationId, data) {
        const existing = await this.integrations.findOne({
            where: { organizationId, provider: integration_provider_enum_1.IntegrationProvider.META },
        });
        if (existing) {
            existing.status = data.status;
            existing.config = { ...existing.config, ...data.config };
            existing.lastSyncAt = new Date();
            existing.errorMessage = undefined;
            return this.integrations.save(existing);
        }
        const integration = this.integrations.create({
            organizationId,
            provider: integration_provider_enum_1.IntegrationProvider.META,
            name: 'Meta',
            status: data.status,
            config: data.config,
            lastSyncAt: new Date(),
        });
        return this.integrations.save(integration);
    }
    async fetchGraph(version, path, accessToken, params) {
        const query = new URLSearchParams(params).toString();
        const response = await fetch(`https://graph.facebook.com/${version}${path}?${query}`, {
            headers: { authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        if (!response.ok)
            throw new common_1.BadRequestException('Meta asset discovery failed');
        return data;
    }
};
exports.MetaOAuthService = MetaOAuthService;
exports.MetaOAuthService = MetaOAuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __param(1, (0, typeorm_1.InjectRepository)(integration_account_entity_1.IntegrationAccount)),
    __param(2, (0, typeorm_1.InjectRepository)(meta_conversion_outbox_entity_1.MetaConversionOutbox)),
    __param(3, (0, typeorm_1.InjectRepository)(meta_lead_webhook_event_entity_1.MetaLeadWebhookEvent)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        meta_integration_accessor_service_1.MetaIntegrationAccessor,
        meta_asset_discovery_service_1.MetaAssetDiscoveryService])
], MetaOAuthService);
