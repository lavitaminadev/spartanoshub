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
exports.GoogleDataService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const integration_entity_1 = require("../integration.entity");
const integration_provider_enum_1 = require("../integration-provider.enum");
const integration_account_entity_1 = require("../integration-account.entity");
const integration_account_type_enum_1 = require("../integration-account-type.enum");
const integration_metric_entity_1 = require("../integration-metric.entity");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
const client_entity_1 = require("../../clients/client.entity");
const google_oauth_service_1 = require("./google-oauth.service");
let GoogleDataService = class GoogleDataService {
    constructor(integrations, accounts, metrics, clients, oauth) {
        this.integrations = integrations;
        this.accounts = accounts;
        this.metrics = metrics;
        this.clients = clients;
        this.oauth = oauth;
    }
    async listAccounts(integrationId, organizationId) {
        await this.getIntegration(integrationId, organizationId);
        const accounts = await this.accounts.find({ where: { integrationId }, order: { externalName: 'ASC' } });
        return accounts.map((item) => ({
            id: item.id,
            externalId: item.externalId,
            name: item.externalName,
            type: item.accountType,
            selected: Boolean(item.metadata?.selected),
            clientId: typeof item.metadata?.clientId === 'string' ? item.metadata.clientId : null,
        }));
    }
    async discoverAdsAccounts(integrationId, organizationId) {
        const { integration, token } = await this.getAccess(integrationId, organizationId);
        const response = await this.googleFetch(`https://googleads.googleapis.com/${this.adsApiVersion()}/customers:listAccessibleCustomers`, token, { headers: this.adsHeaders() });
        const discovered = [];
        for (const resource of response.resourceNames ?? []) {
            const customerId = resource.replace('customers/', '');
            let account = await this.accounts.findOne({ where: { integrationId, accountType: integration_account_type_enum_1.IntegrationAccountType.AD_ACCOUNT, externalId: customerId } });
            account ??= this.accounts.create({ integrationId, accountType: integration_account_type_enum_1.IntegrationAccountType.AD_ACCOUNT, externalId: customerId, externalName: `Google Ads ${customerId}`, metadata: {} });
            account.metadata = { ...account.metadata, selected: account.metadata?.selected ?? false };
            discovered.push(await this.accounts.save(account));
        }
        integration.lastSyncAt = new Date();
        await this.integrations.save(integration);
        return discovered.map((item) => ({ id: item.id, externalId: item.externalId, name: item.externalName, selected: Boolean(item.metadata?.selected), clientId: item.metadata?.clientId ?? null }));
    }
    async registerAnalyticsProperty(integrationId, organizationId, propertyId, name, clientId) {
        await this.getAccess(integrationId, organizationId);
        const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new common_1.BadRequestException('El cliente seleccionado no pertenece a esta organización');
        let account = await this.accounts.findOne({ where: { integrationId, accountType: integration_account_type_enum_1.IntegrationAccountType.ANALYTICS_PROPERTY, externalId: propertyId } });
        account ??= this.accounts.create({ integrationId, accountType: integration_account_type_enum_1.IntegrationAccountType.ANALYTICS_PROPERTY, externalId: propertyId, externalName: name });
        account.externalName = name.trim();
        account.metadata = { ...account.metadata, selected: true, clientId: client.id };
        return this.accounts.save(account);
    }
    async sync(integrationId, organizationId) {
        const { token } = await this.getAccess(integrationId, organizationId);
        const accounts = await this.accounts.find({ where: { integrationId } });
        if (!accounts.some((item) => item.metadata?.selected)) {
            throw new common_1.BadRequestException('Asigna al menos una cuenta de Google a un cliente antes de sincronizar');
        }
        let synced = 0;
        const skipped = [];
        const failed = [];
        for (const account of accounts.filter((item) => item.metadata?.selected)) {
            const clientId = typeof account.metadata?.clientId === 'string' ? account.metadata.clientId : undefined;
            if (!clientId) {
                skipped.push(account.externalName);
                continue;
            }
            try {
                if (account.accountType === integration_account_type_enum_1.IntegrationAccountType.AD_ACCOUNT)
                    synced += await this.syncAdsAccount(account, organizationId, clientId, token);
                if (account.accountType === integration_account_type_enum_1.IntegrationAccountType.ANALYTICS_PROPERTY)
                    synced += await this.syncAnalyticsProperty(account, organizationId, clientId, token);
            }
            catch {
                failed.push(account.externalName);
            }
        }
        return { synced, skippedUnassignedAccounts: skipped, failedAccounts: failed };
    }
    async syncAdsAccount(account, organizationId, clientId, token) {
        const query = `SELECT segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions FROM customer WHERE segments.date DURING LAST_30_DAYS`;
        const rows = await this.googleFetch(`https://googleads.googleapis.com/${this.adsApiVersion()}/customers/${account.externalId}/googleAds:searchStream`, token, { method: 'POST', headers: this.adsHeaders(), body: JSON.stringify({ query }) });
        const metricsToUpsert = rows.flatMap((batch) => batch.results ?? []).map((row) => ({
            organizationId, clientId, provider: 'google_ads', externalAccountId: account.externalId,
            metricDate: new Date(row.segments.date), spend: Number(row.metrics.costMicros ?? 0) / 1_000_000,
            impressions: Number(row.metrics.impressions ?? 0), clicks: Number(row.metrics.clicks ?? 0),
            conversions: Number(row.metrics.conversions ?? 0), reach: 0, leads: 0,
        }));
        return this.upsertMetrics(metricsToUpsert);
    }
    async syncAnalyticsProperty(account, organizationId, clientId, token) {
        const property = account.externalId.replace('properties/', '');
        const payload = await this.googleFetch(`https://analyticsdata.googleapis.com/v1beta/properties/${property}:runReport`, token, { method: 'POST', body: JSON.stringify({ dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], dimensions: [{ name: 'date' }], metrics: [{ name: 'sessions' }, { name: 'conversions' }], limit: 100 }) });
        const metricsToUpsert = (payload.rows ?? []).map((row) => {
            const raw = row.dimensionValues?.[0]?.value ?? '';
            const sessions = Number(row.metricValues?.[0]?.value ?? 0);
            return {
                organizationId, clientId, provider: 'google_analytics', externalAccountId: account.externalId,
                metricDate: new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`),
                spend: 0, impressions: 0, reach: 0, clicks: sessions, conversions: Number(row.metricValues?.[1]?.value ?? 0),
                leads: 0, breakdown: { sessions },
            };
        });
        return this.upsertMetrics(metricsToUpsert);
    }
    async upsertMetrics(values) {
        if (values.length === 0)
            return 0;
        await this.metrics.upsert(values, ['provider', 'externalAccountId', 'clientId', 'metricDate']);
        return values.length;
    }
    async getAccess(id, organizationId) {
        let integration = await this.getIntegration(id, organizationId);
        const expiry = typeof integration.config?.expiryDate === 'string' ? Date.parse(integration.config.expiryDate) : Number.NaN;
        if (Number.isFinite(expiry) && expiry <= Date.now() + 60_000) {
            integration = await this.oauth.refreshIntegration(id, organizationId);
        }
        const token = (0, integration_secrets_1.revealSecret)(typeof integration?.config?.accessToken === 'string' ? integration.config.accessToken : undefined);
        if (!token)
            throw new common_1.BadRequestException('Google integration is not connected');
        return { integration, token };
    }
    async getIntegration(id, organizationId) {
        const integration = await this.integrations.findOne({ where: { id, organizationId, provider: integration_provider_enum_1.IntegrationProvider.GOOGLE } });
        if (!integration)
            throw new common_1.BadRequestException('Google integration is not connected');
        return integration;
    }
    adsApiVersion() { const version = process.env.GOOGLE_ADS_API_VERSION?.trim() || 'v24'; return /^v\d+$/.test(version) ? version : 'v24'; }
    adsHeaders() { const developerToken = process.env.GOOGLE_DEVELOPER_TOKEN; if (!developerToken)
        throw new common_1.BadRequestException('GOOGLE_DEVELOPER_TOKEN is required'); return { 'developer-token': developerToken, ...(process.env.GOOGLE_LOGIN_CUSTOMER_ID ? { 'login-customer-id': process.env.GOOGLE_LOGIN_CUSTOMER_ID } : {}) }; }
    async googleFetch(url, token, init = {}) { const response = await fetch(url, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...(init.headers ?? {}) }, signal: AbortSignal.timeout(30000) }); const data = await response.json(); if (!response.ok)
        throw new common_1.BadRequestException(data?.error?.message ?? `Google request failed (${response.status})`); return data; }
};
exports.GoogleDataService = GoogleDataService;
exports.GoogleDataService = GoogleDataService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_entity_1.Integration)),
    __param(1, (0, typeorm_1.InjectRepository)(integration_account_entity_1.IntegrationAccount)),
    __param(2, (0, typeorm_1.InjectRepository)(integration_metric_entity_1.IntegrationMetric)),
    __param(3, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        google_oauth_service_1.GoogleOAuthService])
], GoogleDataService);
