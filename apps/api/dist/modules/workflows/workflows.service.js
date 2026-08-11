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
exports.WorkflowsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const workflow_template_entity_1 = require("./workflow-template.entity");
const workflow_defaults_1 = require("./workflow-defaults");
let WorkflowsService = class WorkflowsService {
    constructor(templates) {
        this.templates = templates;
    }
    async list(organizationId) {
        await this.ensureDefaults(organizationId);
        return this.templates.find({ where: { organizationId }, order: { name: 'ASC' } });
    }
    async getSteps(organizationId, code) {
        await this.ensureDefaults(organizationId);
        const template = await this.templates.findOne({ where: { organizationId, code, isActive: true } });
        return template?.steps?.length ? template.steps : workflow_defaults_1.WORKFLOW_DEFAULTS[code]?.steps ?? [];
    }
    async update(id, organizationId, dto) {
        const template = await this.templates.findOne({ where: { id, organizationId } });
        if (!template)
            throw new common_1.NotFoundException('Flujo no encontrado');
        if (dto.steps && (dto.steps.length < 1 || dto.steps.length > 40))
            throw new common_1.BadRequestException('El flujo debe contener entre 1 y 40 etapas');
        if (dto.steps) {
            const keys = dto.steps.map((step) => step.key.trim().toLowerCase());
            if (new Set(keys).size !== keys.length)
                throw new common_1.BadRequestException('Las claves de las etapas deben ser únicas');
            template.steps = dto.steps.map((step) => ({ ...step, key: step.key.trim().toLowerCase(), label: step.label.trim() }));
        }
        if (dto.name !== undefined)
            template.name = dto.name.trim();
        if (dto.description !== undefined)
            template.description = dto.description.trim() || undefined;
        if (dto.isActive !== undefined)
            template.isActive = dto.isActive;
        template.version += 1;
        return this.templates.save(template);
    }
    async reset(code, organizationId) {
        const value = workflow_defaults_1.WORKFLOW_DEFAULTS[code];
        if (!value)
            throw new common_1.NotFoundException('No existe una plantilla base para este flujo');
        await this.ensureDefaults(organizationId);
        const template = await this.templates.findOneOrFail({ where: { organizationId, code } });
        Object.assign(template, value, { isActive: true, version: template.version + 1 });
        return this.templates.save(template);
    }
    async ensureDefaults(organizationId) {
        const existing = new Set((await this.templates.find({ select: { code: true }, where: { organizationId } })).map((row) => row.code));
        const missing = Object.entries(workflow_defaults_1.WORKFLOW_DEFAULTS).filter(([code]) => !existing.has(code)).map(([code, value]) => this.templates.create({ organizationId, code, ...value }));
        if (missing.length)
            await this.templates.save(missing);
    }
};
exports.WorkflowsService = WorkflowsService;
exports.WorkflowsService = WorkflowsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(workflow_template_entity_1.WorkflowTemplate)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], WorkflowsService);
//# sourceMappingURL=workflows.service.js.map