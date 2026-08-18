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
exports.OnboardingService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const onboarding_entity_1 = require("./onboarding.entity");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
const process_templates_service_1 = require("../process-templates/process-templates.service");
let OnboardingService = class OnboardingService {
    constructor(repo, clients, users, workflows) {
        this.repo = repo;
        this.clients = clients;
        this.users = users;
        this.workflows = workflows;
    }
    async create(dto, organizationId) {
        await this.validateReferences(dto.clientId, dto.assignedTo, organizationId);
        const item = this.repo.create({ ...dto, organizationId, step: dto.step.trim(), notes: dto.notes?.trim() || undefined, blockedReason: dto.blockedReason?.trim() || undefined });
        return this.repo.save(item);
    }
    async findAll(organizationId, limit = 50, offset = 0) {
        const [data, total] = await this.repo.findAndCount({
            where: { organizationId },
            order: { createdAt: 'DESC' },
            take: limit,
            skip: offset,
        });
        return { data, total, limit, offset };
    }
    async findOne(id, organizationId) {
        const item = await this.repo.findOne({ where: { id, organizationId } });
        if (!item)
            throw new common_1.NotFoundException('Onboarding step not found');
        return item;
    }
    async update(id, dto, organizationId) {
        const item = await this.findOne(id, organizationId);
        if (dto.assignedTo)
            await this.validateReferences(item.clientId, dto.assignedTo, organizationId);
        Object.assign(item, dto);
        if (dto.step !== undefined)
            item.step = dto.step.trim();
        if (dto.notes !== undefined)
            item.notes = dto.notes.trim() || undefined;
        if (dto.blockedReason !== undefined)
            item.blockedReason = dto.blockedReason.trim() || undefined;
        if (dto.status === 'completed' && !item.completedAt)
            item.completedAt = new Date();
        if (dto.status && dto.status !== 'completed')
            item.completedAt = undefined;
        return this.repo.save(item);
    }
    async remove(id, organizationId) {
        const item = await this.findOne(id, organizationId);
        return this.repo.remove(item);
    }
    async createStandardChecklist(clientId, organizationId) {
        await this.validateReferences(clientId, undefined, organizationId);
        const existing = await this.repo.find({ where: { clientId, organizationId } });
        const existingSteps = new Set(existing.map((item) => item.step.trim().toLowerCase()));
        const workflowSteps = await this.workflows.getSteps(organizationId, 'onboarding');
        const missing = workflowSteps
            .filter((step) => !existingSteps.has(step.label.toLowerCase()))
            .map((step) => this.repo.create({
            clientId,
            organizationId,
            step: step.label,
            status: 'pending',
            notes: step.slaHours ? `SLA sugerido: ${step.slaHours} horas${step.responsibleRole ? ` · Responsable: ${step.responsibleRole}` : ''}` : undefined,
        }));
        if (missing.length === 0)
            return existing;
        return this.repo.save(missing);
    }
    async validateReferences(clientId, assignedTo, organizationId) {
        const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
        if (!client)
            throw new common_1.BadRequestException('El cliente no pertenece a esta organización');
        if (assignedTo) {
            const user = await this.users.findOne({ where: { id: assignedTo, organizationId, isActive: true } });
            if (!user)
                throw new common_1.BadRequestException('El responsable no pertenece a esta organización o está inactivo');
        }
    }
};
exports.OnboardingService = OnboardingService;
exports.OnboardingService = OnboardingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(onboarding_entity_1.Onboarding)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        process_templates_service_1.ProcessTemplatesService])
], OnboardingService);
