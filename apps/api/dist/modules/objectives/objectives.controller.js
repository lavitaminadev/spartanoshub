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
exports.ObjectivesController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const objective_entity_1 = require("./objective.entity");
const client_entity_1 = require("../clients/client.entity");
const user_entity_1 = require("../users/user.entity");
const objective_dto_1 = require("./dto/objective.dto");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let ObjectivesController = class ObjectivesController {
    constructor(repo, clients, users) {
        this.repo = repo;
        this.clients = clients;
        this.users = users;
    }
    list(req) {
        const personalRoles = [user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL];
        return this.repo.find({
            where: {
                organizationId: req.organizationId,
                ...(personalRoles.includes(req.user.role) ? { ownerId: req.user.id } : {}),
            },
            order: { dueAt: 'ASC', createdAt: 'DESC' },
        });
    }
    async create(dto, req) {
        await this.validateReferences(req.organizationId, dto.ownerId, dto.clientId);
        return this.repo.save(this.repo.create({
            ...dto,
            title: dto.title.trim(),
            description: dto.description?.trim() || undefined,
            dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
            organizationId: req.organizationId,
            createdBy: req.user.id,
            progress: dto.progress ?? 0,
        }));
    }
    async update(id, dto, req) {
        const objective = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
        if (!objective)
            throw new common_1.NotFoundException('Objective not found');
        await this.validateReferences(req.organizationId, dto.ownerId, dto.clientId);
        if (dto.ownerId !== undefined)
            objective.ownerId = dto.ownerId;
        if (dto.clientId !== undefined)
            objective.clientId = dto.clientId;
        if (dto.category !== undefined)
            objective.category = dto.category;
        if (dto.title !== undefined)
            objective.title = dto.title.trim();
        if (dto.description !== undefined)
            objective.description = dto.description.trim() || undefined;
        if (dto.status !== undefined)
            objective.status = dto.status;
        if (dto.progress !== undefined)
            objective.progress = dto.progress;
        if (dto.dueAt !== undefined)
            objective.dueAt = new Date(dto.dueAt);
        if (objective.progress === 100)
            objective.status = 'completed';
        return this.repo.save(objective);
    }
    async validateReferences(organizationId, ownerId, clientId) {
        const [owner, client] = await Promise.all([
            ownerId ? this.users.findOne({ where: { id: ownerId, organizationId, isActive: true } }) : undefined,
            clientId ? this.clients.findOne({ where: { id: clientId, organizationId } }) : undefined,
        ]);
        if (ownerId && !owner)
            throw new common_1.BadRequestException('El responsable no pertenece a esta organizacion');
        if (clientId && !client)
            throw new common_1.BadRequestException('El cliente no pertenece a esta organizacion');
    }
};
exports.ObjectivesController = ObjectivesController;
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], ObjectivesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [objective_dto_1.CreateObjectiveDto, Object]),
    __metadata("design:returntype", Promise)
], ObjectivesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, objective_dto_1.UpdateObjectiveDto, Object]),
    __metadata("design:returntype", Promise)
], ObjectivesController.prototype, "update", null);
exports.ObjectivesController = ObjectivesController = __decorate([
    (0, swagger_1.ApiTags)('Objetivos'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, common_1.Controller)('objectives'),
    (0, module_scope_decorator_1.ModuleScope)('direction'),
    __param(0, (0, typeorm_1.InjectRepository)(objective_entity_1.Objective)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ObjectivesController);
//# sourceMappingURL=objectives.controller.js.map