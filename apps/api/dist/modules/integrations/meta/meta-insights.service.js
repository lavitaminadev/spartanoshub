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
var MetaInsightsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaInsightsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const integration_account_entity_1 = require("../integration-account.entity");
const integration_account_type_enum_1 = require("../integration-account-type.enum");
const integration_metric_entity_1 = require("../integration-metric.entity");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
let MetaInsightsService = MetaInsightsService_1 = class MetaInsightsService {
    constructor(accounts, metrics) {
        this.accounts = accounts;
        this.metrics = metrics;
        this.logger = new common_1.Logger(MetaInsightsService_1.name);
    }
    async sync(integrationId, organizationId) {
        const accounts = await this.accounts.find({ where: { integrationId, accountType: integration_account_type_enum_1.IntegrationAccountType.AD_ACCOUNT }, relations: { integration: true } });
        let synced = 0;
        const skipped = [];
        const failed = [];
        for (const account of accounts.filter((item) => item.metadata?.selected)) {
            if (account.integration.organizationId !== organizationId)
                continue;
            const clientId = typeof account.metadata?.clientId === 'string' ? account.metadata.clientId : undefined;
            if (!clientId) {
                skipped.push(account.externalName);
                continue;
            }
            try {
                const token = (0, integration_secrets_1.revealSecret)(typeof account.integration.config?.accessToken === 'string' ? account.integration.config.accessToken : undefined);
                if (!token)
                    throw new common_1.BadRequestException('Meta access token unavailable');
                const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
                const params = new URLSearchParams({ fields: 'date_start,spend,impressions,reach,clicks,actions', date_preset: 'last_30d', time_increment: '1', limit: '100' });
                const response = await fetch(`https://graph.facebook.com/${version}/${account.externalId}/insights?${params}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20000) });
                const payload = await response.json();
                if (!response.ok)
                    throw new common_1.BadRequestException(payload.error?.message ?? 'Meta Insights sync failed');
                const metricsToUpsert = (payload.data ?? []).map((row) => {
                    const actions = Object.fromEntries((row.actions ?? []).map((action) => [action.action_type, Number(action.value)]));
                    return {
                        organizationId,
                        provider: 'meta',
                        externalAccountId: account.externalId,
                        clientId,
                        metricDate: new Date(row.date_start),
                        spend: Number(row.spend ?? 0),
                        impressions: Number(row.impressions ?? 0),
                        reach: Number(row.reach ?? 0),
                        clicks: Number(row.clicks ?? 0),
                        leads: actions.lead ?? actions.onsite_conversion_lead_grouped ?? 0,
                        conversions: actions.purchase ?? actions.offsite_conversion ?? 0,
                        breakdown: { actions },
                    };
                });
                if (metricsToUpsert.length > 0) {
                    await this.metrics.upsert(metricsToUpsert, ['provider', 'externalAccountId', 'clientId', 'metricDate']);
                    synced += metricsToUpsert.length;
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : 'Unknown error';
                this.logger.warn(`Meta insights sync failed for account ${account.externalId} (${account.externalName}): ${message}`);
                failed.push(account.externalName);
            }
        }
        return { synced, skippedUnassignedAccounts: skipped, failedAccounts: failed };
    }
};
exports.MetaInsightsService = MetaInsightsService;
exports.MetaInsightsService = MetaInsightsService = MetaInsightsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_account_entity_1.IntegrationAccount)),
    __param(1, (0, typeorm_1.InjectRepository)(integration_metric_entity_1.IntegrationMetric)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], MetaInsightsService);
