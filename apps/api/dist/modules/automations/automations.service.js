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
exports.AutomationsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const automation_entity_1 = require("./automation.entity");
const automation_run_entity_1 = require("./automation-run.entity");
const automation_run_step_entity_1 = require("./automation-run-step.entity");
const user_entity_1 = require("../users/user.entity");
const automation_graph_1 = require("./automation-graph");
const automation_catalog_1 = require("./automation-catalog");
let AutomationsService = class AutomationsService {
    constructor(automations, runs, steps, users) {
        this.automations = automations;
        this.runs = runs;
        this.steps = steps;
        this.users = users;
    }
    catalog() {
        return { triggers: automation_catalog_1.AUTOMATION_TRIGGERS, actions: automation_catalog_1.AUTOMATION_ACTIONS };
    }
    list(organizationId) {
        return this.automations.find({ where: { organizationId }, order: { updatedAt: 'DESC' } });
    }
    async get(id, organizationId) {
        const automation = await this.automations.findOne({ where: { id, organizationId } });
        if (!automation)
            throw new common_1.NotFoundException('Automatización no encontrada');
        return automation;
    }
    async create(organizationId, dto, createdBy) {
        this.assertTrigger(dto.triggerType);
        (0, automation_graph_1.assertValidGraph)(dto.graph);
        await this.assertRunAsUser(organizationId, dto.runAsUserId);
        return this.automations.save(this.automations.create({
            organizationId,
            name: dto.name.trim(),
            description: dto.description?.trim() || null,
            triggerType: dto.triggerType,
            graph: dto.graph,
            runAsUserId: dto.runAsUserId,
            isActive: false,
            version: 1,
            createdBy,
        }));
    }
    async update(id, organizationId, dto) {
        const automation = await this.get(id, organizationId);
        this.assertTrigger(dto.triggerType);
        (0, automation_graph_1.assertValidGraph)(dto.graph);
        await this.assertRunAsUser(organizationId, dto.runAsUserId);
        automation.name = dto.name.trim();
        automation.description = dto.description?.trim() || null;
        automation.triggerType = dto.triggerType;
        automation.graph = dto.graph;
        automation.runAsUserId = dto.runAsUserId;
        automation.version += 1;
        return this.automations.save(automation);
    }
    async setActive(id, organizationId, isActive) {
        const automation = await this.get(id, organizationId);
        if (isActive)
            (0, automation_graph_1.assertValidGraph)(automation.graph);
        automation.isActive = isActive;
        return this.automations.save(automation);
    }
    async remove(id, organizationId) {
        const automation = await this.get(id, organizationId);
        await this.automations.remove(automation);
    }
    listRuns(id, organizationId, limit = 50) {
        return this.runs.find({
            where: { automationId: id, organizationId },
            order: { createdAt: 'DESC' },
            take: Math.min(Math.max(limit, 1), 200),
        });
    }
    async runDetail(runId, organizationId) {
        const run = await this.runs.findOne({ where: { id: runId, organizationId } });
        if (!run)
            throw new common_1.NotFoundException('Ejecución no encontrada');
        const steps = await this.steps.find({ where: { runId }, order: { createdAt: 'ASC' } });
        return { run, steps };
    }
    assertTrigger(triggerType) {
        if (!(0, automation_catalog_1.findTrigger)(triggerType)) {
            throw new common_1.BadRequestException(`El disparador "${triggerType}" no existe`);
        }
    }
    async assertRunAsUser(organizationId, runAsUserId) {
        const user = await this.users.findOne({
            where: { id: runAsUserId, organizationId, isActive: true },
            select: { id: true },
        });
        if (!user)
            throw new common_1.BadRequestException('La identidad de ejecución debe ser una persona activa de la organización');
    }
};
exports.AutomationsService = AutomationsService;
exports.AutomationsService = AutomationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(automation_entity_1.Automation)),
    __param(1, (0, typeorm_1.InjectRepository)(automation_run_entity_1.AutomationRun)),
    __param(2, (0, typeorm_1.InjectRepository)(automation_run_step_entity_1.AutomationRunStep)),
    __param(3, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], AutomationsService);
