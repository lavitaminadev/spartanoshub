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
var LeadIntakeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadIntakeService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const audit_service_1 = require("../../../core/audit/audit.service");
const lead_entity_1 = require("./lead.entity");
const lead_fit_status_enum_1 = require("./lead-fit-status.enum");
const lead_status_enum_1 = require("./lead-status.enum");
const crm_lead_automation_service_1 = require("./crm-lead-automation.service");
const phone_1 = require("../../../shared/phone");
const GENERIC_EMAIL_DOMAINS = new Set([
    'gmail.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'yahoo.com',
    'live.com',
]);
const HIGH_INTENT_KEYWORDS = [
    'presupuesto',
    'cotizacion',
    'cotización',
    'reunion',
    'reunión',
    'agendar',
    'campana',
    'campaña',
    'marketing',
    'publicidad',
    'ads',
    'ventas',
    'clientes',
    'reserva',
    'restaurante',
    'clinica',
    'clínica',
];
const LOW_QUALITY_KEYWORDS = [
    'trabajo',
    'empleo',
    'practica',
    'práctica',
    'curriculum',
    'currículum',
    'proveedor',
    'factura',
    'spam',
    'prueba',
    'test',
    'soporte',
];
let LeadIntakeService = LeadIntakeService_1 = class LeadIntakeService {
    constructor(repo, automation, audit) {
        this.repo = repo;
        this.automation = automation;
        this.audit = audit;
        this.logger = new common_1.Logger(LeadIntakeService_1.name);
    }
    async captureAudience(input) {
        return this.capture({ ...input, domain: 'audience' });
    }
    async captureLead(input, mode = 'upsert') {
        const { lead } = await this.capture(input, mode);
        return lead;
    }
    async capture(input, mode = 'upsert') {
        const { domain, payload } = this.splitDomain(input);
        const normalized = this.normalizeInput(payload);
        const transactionManager = this.repo.manager;
        if (!transactionManager?.transaction) {
            return this.persistCapture(normalized, domain, this.repo, undefined, mode);
        }
        return transactionManager.transaction(async (manager) => this.persistCapture(normalized, domain, manager.getRepository(lead_entity_1.Lead), manager, mode));
    }
    async persistCapture(normalized, domain, repo, manager, mode = 'upsert') {
        if (mode === 'create-only') {
            const replay = await this.findReplay(normalized, repo);
            if (replay)
                return { lead: replay, contact: null };
        }
        const match = mode === 'create-only'
            ? { lead: null }
            : await this.findExistingLead(normalized, repo, domain);
        const qualification = this.qualifyLead(normalized, domain);
        const retentionReviewAt = this.buildRetentionReviewDate();
        const lead = match.lead ?? repo.create({ organizationId: normalized.organizationId });
        const identityChange = match.lead ? this.identityDiff(match.lead, normalized) : null;
        Object.assign(lead, {
            ...normalized,
            domain: match.lead?.domain ?? domain,
            sourceCreatedAt: match.lead?.sourceCreatedAt ?? normalized.sourceCreatedAt ?? null,
            qualityScore: qualification.qualityScore,
            fitStatus: qualification.fitStatus,
            discardReason: qualification.discardReason,
            retentionReviewAt: normalized.retentionReviewAt ?? retentionReviewAt,
            metadata: {
                ...(match.lead?.metadata ?? {}),
                ...(normalized.metadata ?? {}),
                scoringSignals: qualification.scoringSignals,
                ...(match.conflict ? { identityConflict: { ...match.conflict, detectedAt: new Date().toISOString() } } : {}),
            },
        });
        if (!lead.status)
            lead.status = 'new';
        const savedLead = await repo.save(lead);
        if (identityChange)
            await this.recordIdentityChange(savedLead, identityChange);
        const contact = await this.runAutomation(savedLead, domain, manager);
        return { lead: await repo.save(savedLead), contact };
    }
    async findReplay(input, repo) {
        if (!input.externalLeadId)
            return null;
        return repo.findOne({ where: { organizationId: input.organizationId, externalLeadId: input.externalLeadId } });
    }
    identityDiff(existing, incoming) {
        const fields = ['name', 'email', 'phone', 'company'];
        const before = {};
        const after = {};
        for (const field of fields) {
            const next = incoming[field];
            if (next === undefined || next === existing[field])
                continue;
            before[field] = existing[field];
            after[field] = next;
        }
        return Object.keys(after).length > 0 ? { before, after } : null;
    }
    async recordIdentityChange(lead, change) {
        try {
            await this.audit.log({
                organizationId: lead.organizationId,
                actorId: undefined,
                entityType: 'crm_leads',
                entityId: lead.id,
                action: 'identity_overwritten',
                before: change.before,
                after: change.after,
                reason: `capture:${lead.source ?? 'desconocido'}`,
            });
        }
        catch (error) {
            this.logger.warn(`No se pudo auditar la sobrescritura del lead ${lead.id}: ${error instanceof Error ? error.message : error}`);
        }
    }
    splitDomain(input) {
        const { domain = 'commercial', ...payload } = input;
        return { domain, payload };
    }
    async runAutomation(lead, domain, manager) {
        if (domain === 'audience') {
            return this.automation.ensureAudienceContact(lead, manager);
        }
        await this.automation.runForLead(lead, manager);
        return null;
    }
    normalizeInput(input) {
        return {
            ...input,
            name: input.name.trim().replace(/\s+/g, ' '),
            email: input.email?.trim().toLowerCase() || undefined,
            phone: (0, phone_1.normalizePhone)(input.phone),
            company: input.company?.trim().replace(/\s+/g, ' ') || undefined,
            source: input.source?.trim().toLowerCase().replace(/\s+/g, '_') || undefined,
            sourceDetail: input.sourceDetail?.trim().replace(/\s+/g, ' ') || undefined,
            campaignName: input.campaignName?.trim().replace(/\s+/g, ' ') || undefined,
            notes: input.notes?.trim() || undefined,
        };
    }
    async updateStatusByContact(organizationId, status, email, phone, clientId) {
        if (!email && !phone)
            return null;
        const conditions = [];
        const base = { organizationId };
        if (clientId)
            base.clientId = clientId;
        if (email)
            conditions.push({ ...base, email });
        if (phone)
            conditions.push({ ...base, phone });
        const lead = await this.repo.findOne({ where: conditions });
        if (!lead)
            return null;
        if (!(0, lead_status_enum_1.isStatusInDomain)(lead.domain, status)) {
            this.logger.warn(`No se refleja el estado "${status}" en el lead ${lead.id}: es de dominio ${lead.domain}`);
            return null;
        }
        lead.status = status;
        return this.repo.save(lead);
    }
    async findExistingLead(input, repo = this.repo, domain = 'commercial') {
        if (input.externalLeadId) {
            const byExternalId = await repo.findOne({
                where: { organizationId: input.organizationId, externalLeadId: input.externalLeadId },
            });
            if (byExternalId)
                return { lead: byExternalId, matchedBy: 'externalLeadId' };
        }
        const baseWhere = { organizationId: input.organizationId };
        if (input.clientId)
            baseWhere.clientId = input.clientId;
        const [byPhone, byEmail] = await Promise.all([
            input.phone ? repo.findOne({ where: { ...baseWhere, phone: input.phone } }) : Promise.resolve(null),
            input.email ? repo.findOne({ where: { ...baseWhere, email: input.email } }) : Promise.resolve(null),
        ]);
        if (byPhone && byEmail && byPhone.id !== byEmail.id) {
            return {
                lead: null,
                conflict: { otherLeadId: (domain === 'audience' ? byEmail : byPhone).id, otherMatchedBy: domain === 'audience' ? 'email' : 'phone' },
            };
        }
        if (domain === 'audience') {
            if (byPhone)
                return { lead: byPhone, matchedBy: 'phone' };
            if (byEmail)
                return { lead: byEmail, matchedBy: 'email' };
        }
        else {
            if (byEmail)
                return { lead: byEmail, matchedBy: 'email' };
            if (byPhone)
                return { lead: byPhone, matchedBy: 'phone' };
        }
        return { lead: null };
    }
    qualifyLead(input, domain = 'commercial') {
        if (domain === 'audience') {
            return { qualityScore: 0, fitStatus: lead_fit_status_enum_1.LeadFitStatus.REVIEW, scoringSignals: ['audience'] };
        }
        let qualityScore = 0;
        const signals = [];
        const haystack = [
            input.sourceDetail,
            input.campaignName,
            input.company,
            input.notes,
            JSON.stringify(input.metadata ?? {}),
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        if (input.email) {
            qualityScore += 20;
            signals.push('email');
        }
        if (input.phone) {
            qualityScore += 25;
            signals.push('phone');
        }
        if (input.company) {
            qualityScore += 15;
            signals.push('company');
        }
        if (input.email && !this.isGenericEmail(input.email)) {
            qualityScore += 10;
            signals.push('work_email');
        }
        if (input.source === 'meta_lead_ads') {
            qualityScore += 10;
            signals.push('meta_source');
        }
        if (input.externalCampaignId || input.campaignName) {
            qualityScore += 5;
            signals.push('campaign_context');
        }
        const highIntentHits = HIGH_INTENT_KEYWORDS.filter((keyword) => haystack.includes(keyword));
        qualityScore += highIntentHits.length * 6;
        if (highIntentHits.length > 0)
            signals.push(`high_intent:${highIntentHits.slice(0, 3).join(',')}`);
        const lowQualityHits = LOW_QUALITY_KEYWORDS.filter((keyword) => haystack.includes(keyword));
        if (lowQualityHits.length > 0) {
            return {
                qualityScore: Math.max(qualityScore - 30, 0),
                fitStatus: lead_fit_status_enum_1.LeadFitStatus.DISCARDED,
                discardReason: `Se detectaron señales de bajo encaje: ${lowQualityHits.slice(0, 3).join(', ')}`,
                scoringSignals: [...signals, `low_quality:${lowQualityHits.slice(0, 3).join(',')}`],
            };
        }
        if (!input.email && !input.phone) {
            return {
                qualityScore,
                fitStatus: lead_fit_status_enum_1.LeadFitStatus.DISCARDED,
                discardReason: 'No dejó email ni teléfono para contacto comercial.',
                scoringSignals: [...signals, 'missing_contact_channel'],
            };
        }
        if (qualityScore >= 70) {
            return { qualityScore, fitStatus: lead_fit_status_enum_1.LeadFitStatus.QUALIFIED, scoringSignals: signals };
        }
        if (qualityScore >= 35) {
            return { qualityScore, fitStatus: lead_fit_status_enum_1.LeadFitStatus.REVIEW, scoringSignals: signals };
        }
        return {
            qualityScore,
            fitStatus: lead_fit_status_enum_1.LeadFitStatus.DISCARDED,
            discardReason: 'Puntaje insuficiente para priorización comercial.',
            scoringSignals: [...signals, 'low_score'],
        };
    }
    isGenericEmail(email) {
        const domain = email.split('@')[1]?.toLowerCase();
        return Boolean(domain && GENERIC_EMAIL_DOMAINS.has(domain));
    }
    buildRetentionReviewDate() {
        const retentionDays = Number(process.env.CRM_LEAD_RETENTION_DAYS ?? '');
        if (!Number.isFinite(retentionDays) || retentionDays <= 0)
            return undefined;
        return new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000);
    }
};
exports.LeadIntakeService = LeadIntakeService;
exports.LeadIntakeService = LeadIntakeService = LeadIntakeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        crm_lead_automation_service_1.CrmLeadAutomationService,
        audit_service_1.AuditService])
], LeadIntakeService);
