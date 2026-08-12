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
var MetaLeadRecoveryJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaLeadRecoveryJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const meta_lead_ads_service_1 = require("../../../modules/integrations/meta/meta-lead-ads.service");
const integration_account_entity_1 = require("../../../modules/integrations/integration-account.entity");
const integration_account_type_enum_1 = require("../../../modules/integrations/integration-account-type.enum");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
let MetaLeadRecoveryJob = MetaLeadRecoveryJob_1 = class MetaLeadRecoveryJob {
    constructor(accountsRepo, metaLeadAdsService) {
        this.accountsRepo = accountsRepo;
        this.metaLeadAdsService = metaLeadAdsService;
        this.logger = new common_1.Logger(MetaLeadRecoveryJob_1.name);
    }
    async handle() {
        this.logger.log('Starting Meta Lead Recovery Job (Reconciliation)...');
        const pages = await this.accountsRepo.find({
            where: { accountType: integration_account_type_enum_1.IntegrationAccountType.PAGE },
            relations: ['integration'],
        });
        for (const page of pages) {
            if (!page.integration?.organizationId)
                continue;
            const accessToken = (0, integration_secrets_1.revealSecret)(page.accessToken);
            if (!accessToken) {
                this.logger.warn(`Page ${page.externalId} has no access token. Skipping recovery.`);
                continue;
            }
            try {
                this.logger.log(`Fetching last leads for Page ${page.externalId}...`);
                const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
                const since = Math.floor(Date.now() / 1000) - (4 * 3600);
                const response = await fetch(`https://graph.facebook.com/${version}/${page.externalId}/leadgen_forms`, {
                    headers: { authorization: `Bearer ${accessToken}` },
                    signal: AbortSignal.timeout(20000),
                });
                if (!response.ok) {
                    this.logger.error(`Failed to fetch forms for page ${page.externalId}`);
                    continue;
                }
                const formsData = await response.json();
                for (const form of formsData.data || []) {
                    const filtering = JSON.stringify([{ field: 'time_created', operator: 'GREATER_THAN', value: since }]);
                    const leadsRes = await fetch(`https://graph.facebook.com/${version}/${form.id}/leads?filtering=${encodeURIComponent(filtering)}`, {
                        headers: { authorization: `Bearer ${accessToken}` },
                        signal: AbortSignal.timeout(20000),
                    });
                    if (!leadsRes.ok)
                        continue;
                    const leadsData = await leadsRes.json();
                    for (const lead of leadsData.data || []) {
                        try {
                            await this.metaLeadAdsService.syncSingleLead(page.externalId, lead.id);
                        }
                        catch (leadError) {
                            this.logger.error(`Failed to recover lead ${lead.id} for page ${page.externalId}: ${leadError instanceof Error ? leadError.message : leadError}`);
                        }
                    }
                }
            }
            catch (error) {
                this.logger.error(`Error recovering leads for Page ${page.externalId}:`, error);
            }
        }
        this.logger.log('Meta Lead Recovery Job completed.');
    }
};
exports.MetaLeadRecoveryJob = MetaLeadRecoveryJob;
exports.MetaLeadRecoveryJob = MetaLeadRecoveryJob = MetaLeadRecoveryJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_account_entity_1.IntegrationAccount)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        meta_lead_ads_service_1.MetaLeadAdsService])
], MetaLeadRecoveryJob);
