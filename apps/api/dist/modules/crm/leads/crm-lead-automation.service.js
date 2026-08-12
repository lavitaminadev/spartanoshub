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
var CrmLeadAutomationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmLeadAutomationService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const contact_entity_1 = require("../contacts/contact.entity");
const opportunity_entity_1 = require("../opportunities/opportunity.entity");
const interaction_entity_1 = require("../interactions/interaction.entity");
const user_entity_1 = require("../../users/user.entity");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const lead_fit_status_enum_1 = require("./lead-fit-status.enum");
const shared_1 = require("@espartanos/shared");
let CrmLeadAutomationService = CrmLeadAutomationService_1 = class CrmLeadAutomationService {
    constructor(contactsRepo, opportunitiesRepo, interactionsRepo, usersRepo) {
        this.contactsRepo = contactsRepo;
        this.opportunitiesRepo = opportunitiesRepo;
        this.interactionsRepo = interactionsRepo;
        this.usersRepo = usersRepo;
    }
    async runForLead(lead, manager) {
        if (this.isAudienceLead(lead)) {
            await this.ensureAudienceContact(lead, manager);
            return;
        }
        await this.ensureIntakeInteraction(lead, manager);
        if (lead.fitStatus === lead_fit_status_enum_1.LeadFitStatus.DISCARDED) {
            await this.ensureDiscardInteraction(lead, manager);
            return;
        }
        if (lead.fitStatus !== lead_fit_status_enum_1.LeadFitStatus.QUALIFIED)
            return;
        const ownerId = await this.resolveCommercialOwner(lead.organizationId, manager);
        if (ownerId && !lead.assignedTo) {
            lead.assignedTo = ownerId;
        }
        await this.ensureContact(lead, manager);
        await this.ensureOpportunity(lead, ownerId ?? lead.assignedTo, manager);
        await this.ensureQualifiedInteraction(lead, ownerId ?? lead.assignedTo, manager);
    }
    async ensureAudienceContact(lead, manager) {
        return this.ensureContact(lead, manager);
    }
    isAudienceLead(lead) {
        return Boolean(lead.source && CrmLeadAutomationService_1.AUDIENCE_SOURCES.has(lead.source));
    }
    async ensureContact(lead, manager) {
        const repo = manager?.getRepository(contact_entity_1.Contact) ?? this.contactsRepo;
        const existing = await repo.findOne({ where: { organizationId: lead.organizationId, leadId: lead.id } });
        if (existing) {
            const changed = existing.name !== lead.name
                || (existing.email ?? null) !== (lead.email ?? null)
                || (existing.phone ?? null) !== (lead.phone ?? null);
            if (!changed)
                return existing;
            existing.name = lead.name;
            existing.email = lead.email ?? null;
            existing.phone = lead.phone ?? null;
            return repo.save(existing);
        }
        return repo.save(repo.create({
            organizationId: lead.organizationId,
            leadId: lead.id,
            clientId: lead.clientId ?? undefined,
            name: lead.name,
            email: lead.email ?? undefined,
            phone: lead.phone ?? undefined,
            notes: lead.notes,
        }));
    }
    async ensureOpportunity(lead, ownerId, manager) {
        if (this.isAudienceLead(lead))
            return;
        const repo = manager?.getRepository(opportunity_entity_1.Opportunity) ?? this.opportunitiesRepo;
        const existing = await repo.findOne({ where: { organizationId: lead.organizationId, leadId: lead.id } });
        if (existing)
            return;
        await repo.save(repo.create({
            organizationId: lead.organizationId,
            leadId: lead.id,
            name: lead.company || lead.name,
            stage: 'qualified',
            probability: 35,
            assignedTo: ownerId,
            expectedCloseDate: this.buildExpectedCloseDate(),
        }));
    }
    async ensureIntakeInteraction(lead, manager) {
        const repo = manager?.getRepository(interaction_entity_1.Interaction) ?? this.interactionsRepo;
        const existing = await repo.findOne({
            where: { organizationId: lead.organizationId, leadId: lead.id, type: 'lead_ingested' },
        });
        if (existing)
            return;
        await repo.save(repo.create({
            organizationId: lead.organizationId,
            leadId: lead.id,
            type: 'lead_ingested',
            description: `Lead ingresado desde ${lead.sourceDetail || lead.source || 'origen desconocido'}.`,
        }));
    }
    async ensureQualifiedInteraction(lead, ownerId, manager) {
        const repo = manager?.getRepository(interaction_entity_1.Interaction) ?? this.interactionsRepo;
        const existing = await repo.findOne({
            where: { organizationId: lead.organizationId, leadId: lead.id, type: 'lead_qualified' },
        });
        if (existing)
            return;
        await repo.save(repo.create({
            organizationId: lead.organizationId,
            leadId: lead.id,
            type: 'lead_qualified',
            description: `Lead calificado automáticamente con score ${lead.qualityScore}.`,
            createdBy: ownerId,
        }));
    }
    async ensureDiscardInteraction(lead, manager) {
        const repo = manager?.getRepository(interaction_entity_1.Interaction) ?? this.interactionsRepo;
        const existing = await repo.findOne({
            where: { organizationId: lead.organizationId, leadId: lead.id, type: 'lead_discarded' },
        });
        if (existing)
            return;
        await repo.save(repo.create({
            organizationId: lead.organizationId,
            leadId: lead.id,
            type: 'lead_discarded',
            description: lead.discardReason || 'Lead descartado automáticamente por bajo encaje.',
        }));
    }
    async resolveCommercialOwner(organizationId, manager) {
        const repo = manager?.getRepository(user_entity_1.User) ?? this.usersRepo;
        const commercialDirector = await repo.findOne({
            where: { organizationId, role: user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, isActive: true },
            order: { createdAt: 'ASC' },
        });
        if (commercialDirector)
            return commercialDirector.id;
        const admin = await repo.findOne({
            where: { organizationId, role: user_role_enum_1.UserRole.ADMIN, isActive: true },
            order: { createdAt: 'ASC' },
        });
        return admin?.id;
    }
    buildExpectedCloseDate() {
        const date = new Date();
        date.setDate(date.getDate() + 14);
        return date;
    }
};
exports.CrmLeadAutomationService = CrmLeadAutomationService;
CrmLeadAutomationService.AUDIENCE_SOURCES = new Set(shared_1.RESERVATION_LEAD_SOURCES);
exports.CrmLeadAutomationService = CrmLeadAutomationService = CrmLeadAutomationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(contact_entity_1.Contact)),
    __param(1, (0, typeorm_1.InjectRepository)(opportunity_entity_1.Opportunity)),
    __param(2, (0, typeorm_1.InjectRepository)(interaction_entity_1.Interaction)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], CrmLeadAutomationService);
