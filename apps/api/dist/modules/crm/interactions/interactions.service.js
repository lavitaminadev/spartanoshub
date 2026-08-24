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
exports.InteractionsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const interaction_entity_1 = require("./interaction.entity");
const lead_entity_1 = require("../leads/lead.entity");
const contact_entity_1 = require("../contacts/contact.entity");
let InteractionsService = class InteractionsService {
    constructor(repo, leads, contacts) {
        this.repo = repo;
        this.leads = leads;
        this.contacts = contacts;
    }
    async create(dto, organizationId, actorId) {
        await this.validateReferences(dto, organizationId);
        const interaction = this.repo.create({
            ...dto,
            organizationId,
            type: dto.type.trim().toLowerCase(),
            description: dto.description?.trim() || undefined,
            date: dto.date ? new Date(dto.date) : new Date(),
            createdBy: actorId,
        });
        return this.repo.save(interaction);
    }
    async findAll(organizationId, limit = 50, offset = 0, leadId, allowedClientIds) {
        if (allowedClientIds !== undefined) {
            if (allowedClientIds.length === 0)
                return { data: [], total: 0, limit, offset };
            const query = this.repo.createQueryBuilder('interaction')
                .leftJoin(lead_entity_1.Lead, 'lead', 'lead.id = interaction.lead_id AND lead.organization_id = interaction.organization_id')
                .leftJoin(contact_entity_1.Contact, 'contact', 'contact.id = interaction.contact_id AND contact.organization_id = interaction.organization_id')
                .where('interaction.organization_id = :organizationId', { organizationId })
                .andWhere('(lead.client_id IN (:...allowedClientIds) OR contact.client_id IN (:...allowedClientIds))', { allowedClientIds });
            if (leadId)
                query.andWhere('interaction.lead_id = :leadId', { leadId });
            const [data, total] = await query.orderBy('interaction.date', 'DESC').skip(offset).take(limit).getManyAndCount();
            return { data, total, limit, offset };
        }
        const where = { organizationId };
        if (leadId)
            where.leadId = leadId;
        const [data, total] = await this.repo.findAndCount({
            where,
            order: { date: 'DESC' },
            take: limit,
            skip: offset,
        });
        return { data, total, limit, offset };
    }
    async findOne(id, organizationId) {
        const interaction = await this.repo.findOne({ where: { id, organizationId } });
        if (!interaction)
            throw new common_1.NotFoundException('Interaction not found');
        return interaction;
    }
    async update(id, dto, organizationId) {
        const interaction = await this.findOne(id, organizationId);
        await this.validateReferences(dto, organizationId);
        Object.assign(interaction, dto);
        if (dto.type !== undefined)
            interaction.type = dto.type.trim().toLowerCase();
        if (dto.description !== undefined)
            interaction.description = dto.description.trim() || undefined;
        if (dto.date !== undefined)
            interaction.date = new Date(dto.date);
        return this.repo.save(interaction);
    }
    async remove(id, organizationId) {
        const interaction = await this.findOne(id, organizationId);
        return this.repo.remove(interaction);
    }
    async referenceClientId(dto, organizationId) {
        const [lead, contact] = await Promise.all([
            dto.leadId
                ? this.leads.findOne({ where: { id: dto.leadId, organizationId }, select: { id: true, clientId: true } })
                : null,
            dto.contactId
                ? this.contacts.findOne({ where: { id: dto.contactId, organizationId }, select: { id: true, clientId: true, leadId: true } })
                : null,
        ]);
        if (dto.leadId && !lead)
            throw new common_1.NotFoundException('Interaction not found');
        if (dto.contactId && !contact)
            throw new common_1.NotFoundException('Interaction not found');
        return lead?.clientId ?? contact?.clientId;
    }
    async effectiveClientId(interaction, dto, organizationId) {
        return this.referenceClientId({
            leadId: dto.leadId !== undefined ? dto.leadId : interaction.leadId,
            contactId: dto.contactId !== undefined ? dto.contactId : interaction.contactId,
        }, organizationId);
    }
    async validateReferences(dto, organizationId) {
        if (dto.leadId) {
            const lead = await this.leads.findOne({ where: { id: dto.leadId, organizationId }, select: { id: true } });
            if (!lead)
                throw new common_1.BadRequestException('El lead no pertenece a esta organización');
        }
        if (dto.contactId) {
            const contact = await this.contacts.findOne({ where: { id: dto.contactId, organizationId }, select: { id: true, leadId: true } });
            if (!contact)
                throw new common_1.BadRequestException('El contacto no pertenece a esta organización');
            if (dto.leadId && contact.leadId && contact.leadId !== dto.leadId) {
                throw new common_1.BadRequestException('El contacto no pertenece al lead indicado');
            }
        }
    }
};
exports.InteractionsService = InteractionsService;
exports.InteractionsService = InteractionsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(interaction_entity_1.Interaction)),
    __param(1, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(2, (0, typeorm_1.InjectRepository)(contact_entity_1.Contact)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], InteractionsService);
