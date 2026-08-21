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
var MetaLeadAdsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaLeadAdsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const integration_account_entity_1 = require("../integration-account.entity");
const integration_account_type_enum_1 = require("../integration-account-type.enum");
const lead_intake_service_1 = require("../../crm/leads/lead-intake.service");
const meta_lead_webhook_event_entity_1 = require("./meta-lead-webhook-event.entity");
const campaign_entity_1 = require("../../crm/campaigns/campaign.entity");
const integration_secrets_1 = require("../../../shared/security/integration-secrets");
let MetaLeadAdsService = MetaLeadAdsService_1 = class MetaLeadAdsService {
    constructor(accountsRepo, eventsRepo, campaignsRepo, leadIntake) {
        this.accountsRepo = accountsRepo;
        this.eventsRepo = eventsRepo;
        this.campaignsRepo = campaignsRepo;
        this.leadIntake = leadIntake;
        this.logger = new common_1.Logger(MetaLeadAdsService_1.name);
    }
    async resolverEmpresa(organizationId, campaignName) {
        if (!campaignName?.trim())
            return null;
        const campania = await this.campaignsRepo.findOne({
            where: { organizationId, name: campaignName.trim() },
        });
        if (!campania)
            return null;
        return campania.clientId
            ? { clientId: campania.clientId, domain: 'audience' }
            : { domain: 'commercial' };
    }
    async processWebhook(payload, options) {
        const changes = this.extractLeadgenChanges(payload);
        let createdOrUpdated = 0;
        if (changes.length === 0) {
            return { accepted: 0, createdOrUpdated: 0 };
        }
        const pageIds = [...new Set(changes.map(c => c.pageId))];
        const pageAccountsMap = new Map();
        if (pageIds.length > 0) {
            const accounts = await this.accountsRepo.find({
                where: { externalId: (0, typeorm_2.In)(pageIds), accountType: integration_account_type_enum_1.IntegrationAccountType.PAGE },
                relations: { integration: true },
            });
            pageIds.forEach(pageId => {
                pageAccountsMap.set(pageId, accounts.filter(a => a.externalId === pageId));
            });
        }
        const existingEvents = await this.eventsRepo.find({
            where: changes.map(c => ({ pageId: c.pageId, leadgenId: c.leadgenId })),
        });
        const eventMap = new Map(existingEvents.map(e => [`${e.pageId}-${e.leadgenId}`, e]));
        for (const change of changes) {
            const existingEvent = eventMap.get(`${change.pageId}-${change.leadgenId}`);
            if (existingEvent?.processingStatus === 'processed') {
                continue;
            }
            const event = existingEvent ?? this.eventsRepo.create({
                pageId: change.pageId,
                leadgenId: change.leadgenId,
                formId: change.formId,
                rawPayload: change.rawPayload,
                processingStatus: 'received',
            });
            try {
                const pageAccounts = pageAccountsMap.get(change.pageId) ?? [];
                const selectedAccounts = pageAccounts.filter((account) => Boolean(account.metadata?.selected) &&
                    (!options?.organizationId || account.integration?.organizationId === options.organizationId));
                const selectedOrganizations = new Set(selectedAccounts.map((account) => account.integration?.organizationId).filter(Boolean));
                if (selectedOrganizations.size > 1) {
                    event.processingStatus = 'error';
                    event.errorMessage = 'La pagina Meta esta seleccionada en mas de una organizacion; corrige la asignacion antes de procesar leads.';
                    await this.eventsRepo.save(event);
                    continue;
                }
                const pageAccount = selectedAccounts[0] ?? pageAccounts.find((account) => !options?.organizationId || account.integration?.organizationId === options.organizationId);
                if (!pageAccount?.integration?.organizationId) {
                    event.processingStatus = 'ignored';
                    event.errorMessage = 'No existe una página Meta seleccionada para este webhook.';
                    await this.eventsRepo.save(event);
                    continue;
                }
                if (options?.organizationId && pageAccount.integration.organizationId !== options.organizationId) {
                    event.processingStatus = 'ignored';
                    event.errorMessage = 'La pagina Meta no pertenece a la organizacion autenticada.';
                    await this.eventsRepo.save(event);
                    continue;
                }
                if (!pageAccount.metadata?.selected) {
                    event.organizationId = pageAccount.integration.organizationId;
                    event.processingStatus = 'ignored';
                    event.errorMessage = 'La pagina Meta existe pero no esta seleccionada para capturar leads.';
                    await this.eventsRepo.save(event);
                    continue;
                }
                const accessToken = (0, integration_secrets_1.revealSecret)(pageAccount.accessToken);
                if (!accessToken) {
                    event.processingStatus = 'error';
                    event.errorMessage = 'La página Meta no tiene access token para descargar el lead.';
                    await this.eventsRepo.save(event);
                    continue;
                }
                const leadDetail = await this.retrieveLead(change.leadgenId, accessToken);
                const normalized = this.normalizeLeadDetail(leadDetail);
                const destino = await this.resolverEmpresa(pageAccount.integration.organizationId, leadDetail.campaign_name);
                if (!destino) {
                    event.processingStatus = 'error';
                    event.errorMessage = leadDetail.campaign_name
                        ? `La campaña "${leadDetail.campaign_name}" no está registrada en el CRM: no se puede saber de qué empresa es el lead.`
                        : 'El lead llegó sin nombre de campaña: no se puede saber de qué empresa es.';
                    await this.eventsRepo.save(event);
                    continue;
                }
                await this.leadIntake.captureLead({
                    organizationId: pageAccount.integration.organizationId,
                    clientId: destino.clientId,
                    domain: destino.domain,
                    name: normalized.name,
                    email: normalized.email,
                    phone: normalized.phone,
                    company: normalized.company,
                    source: 'meta_lead_ads',
                    sourceDetail: normalized.sourceDetail,
                    notes: normalized.notes,
                    externalLeadId: leadDetail.id,
                    externalFormId: leadDetail.form_id ?? change.formId,
                    externalCampaignId: leadDetail.campaign_id,
                    campaignName: leadDetail.campaign_name,
                    pageId: change.pageId,
                    consentCapturedAt: leadDetail.created_time ? new Date(leadDetail.created_time) : undefined,
                    metadata: {
                        adId: leadDetail.ad_id,
                        adName: leadDetail.ad_name,
                        adsetId: leadDetail.adset_id,
                        adsetName: leadDetail.adset_name,
                        formId: leadDetail.form_id ?? change.formId,
                        platform: leadDetail.platform,
                        fieldData: (leadDetail.field_data ?? []),
                        customDisclaimerResponses: (leadDetail.custom_disclaimer_responses ?? []),
                    },
                });
                event.organizationId = pageAccount.integration.organizationId;
                event.processingStatus = 'processed';
                event.normalizedPayload = {
                    leadgenId: leadDetail.id,
                    campaignName: leadDetail.campaign_name,
                    formId: leadDetail.form_id ?? change.formId,
                    pageId: change.pageId,
                    fieldNames: (leadDetail.field_data ?? []).map((field) => field.name),
                };
                event.processedAt = new Date();
                await this.eventsRepo.save(event);
                createdOrUpdated += 1;
            }
            catch (error) {
                event.processingStatus = 'error';
                event.errorMessage = error instanceof Error ? error.message : 'Error desconocido procesando lead de Meta.';
                await this.eventsRepo.save(event);
                this.logger.error(event.errorMessage);
            }
        }
        return { accepted: changes.length, createdOrUpdated };
    }
    async syncSingleLead(pageId, leadgenId, organizationId) {
        return this.processWebhook({
            object: 'page',
            entry: [{ id: pageId, changes: [{ field: 'leadgen', value: { page_id: pageId, leadgen_id: leadgenId } }] }],
        }, { organizationId });
    }
    extractLeadgenChanges(payload) {
        const changes = [];
        for (const entry of payload.entry ?? []) {
            for (const change of entry.changes ?? []) {
                if (change.field !== 'leadgen' || !change.value?.leadgen_id)
                    continue;
                changes.push({
                    pageId: change.value.page_id ?? entry.id,
                    formId: change.value.form_id,
                    leadgenId: change.value.leadgen_id,
                    rawPayload: { entryId: entry.id, change },
                });
            }
        }
        return changes;
    }
    async retrieveLead(leadgenId, accessToken) {
        const version = process.env.META_GRAPH_API_VERSION ?? 'v23.0';
        const params = new URLSearchParams({
            fields: [
                'id',
                'created_time',
                'ad_id',
                'ad_name',
                'adset_id',
                'adset_name',
                'campaign_id',
                'campaign_name',
                'form_id',
                'field_data',
                'custom_disclaimer_responses',
                'platform',
            ].join(','),
        });
        const response = await fetch(`https://graph.facebook.com/${version}/${leadgenId}?${params.toString()}`, {
            headers: { authorization: `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        if (!response.ok) {
            throw new common_1.BadRequestException(typeof data === 'object' && data && 'error' in data && data.error?.message
                ? data.error.message
                : 'Meta no devolvió el detalle del lead.');
        }
        return data;
    }
    normalizeLeadDetail(lead) {
        const fields = new Map();
        for (const field of lead.field_data ?? []) {
            const value = field.values?.filter(Boolean).join(', ').trim();
            if (value)
                fields.set(field.name.toLowerCase(), value);
        }
        const fullName = fields.get('full_name') ||
            fields.get('name') ||
            [fields.get('first_name'), fields.get('last_name')].filter(Boolean).join(' ').trim() ||
            'Lead Meta';
        const company = fields.get('company_name') || fields.get('company') || fields.get('negocio');
        const notes = Array.from(fields.entries())
            .filter(([name]) => !['full_name', 'name', 'first_name', 'last_name', 'email', 'phone_number', 'phone', 'company_name', 'company', 'negocio'].includes(name))
            .map(([name, value]) => `${name}: ${value}`)
            .join('\n');
        return {
            name: fullName,
            email: fields.get('email'),
            phone: fields.get('phone_number') || fields.get('phone') || fields.get('telefono') || fields.get('teléfono'),
            company,
            sourceDetail: [lead.campaign_name, lead.ad_name, fields.get('service')].filter(Boolean).join(' · '),
            notes: notes || undefined,
        };
    }
};
exports.MetaLeadAdsService = MetaLeadAdsService;
exports.MetaLeadAdsService = MetaLeadAdsService = MetaLeadAdsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(integration_account_entity_1.IntegrationAccount)),
    __param(1, (0, typeorm_1.InjectRepository)(meta_lead_webhook_event_entity_1.MetaLeadWebhookEvent)),
    __param(2, (0, typeorm_1.InjectRepository)(campaign_entity_1.Campaign)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        lead_intake_service_1.LeadIntakeService])
], MetaLeadAdsService);
