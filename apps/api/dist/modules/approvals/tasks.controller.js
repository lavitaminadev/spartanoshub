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
exports.TasksController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const tasks_service_1 = require("./tasks.service");
const task_dto_1 = require("./dto/task.dto");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("../crm/leads/lead.entity");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const client_capability_service_1 = require("../../core/client-scope/client-capability.service");
const permission_resolver_service_1 = require("../../core/authorization/permission-resolver.service");
let TasksController = class TasksController {
    constructor(tasks, leads, accountAccess, capabilities, permissions) {
        this.tasks = tasks;
        this.leads = leads;
        this.accountAccess = accountAccess;
        this.capabilities = capabilities;
        this.permissions = permissions;
    }
    mine(req, limit) {
        return this.tasks.listMine(req.organizationId, req.user.id, limit ? Number(limit) : undefined);
    }
    async agenda(req, from, to) {
        const desde = new Date(from);
        const hasta = new Date(to);
        if (Number.isNaN(desde.getTime()) || Number.isNaN(hasta.getTime())) {
            throw new common_1.BadRequestException('El rango de fechas no es válido');
        }
        const permitidas = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        const data = await this.tasks.listAgenda(req.organizationId, desde, hasta, permitidas);
        return { data };
    }
    async forEntity(entityType, entityId, req) {
        await this.assertEntityAccess(req, entityType, entityId, 'view');
        return this.tasks.listForEntity(req.organizationId, entityType, entityId);
    }
    async create(dto, req) {
        const clientId = await this.assertEntityAccess(req, dto.entityType, dto.entityId, 'edit');
        return this.tasks.create(req.organizationId, req.user.id, { ...dto, clientId });
    }
    async update(id, dto, req) {
        const task = await this.tasks.findOne(req.organizationId, id);
        await this.assertEntityAccess(req, task.entityType, task.entityId, 'edit');
        return this.tasks.update(req.organizationId, id, dto);
    }
    async assertEntityAccess(req, entityType, entityId, level) {
        if (entityType !== 'lead') {
            if (req.user.role === 'client')
                throw new common_1.ForbiddenException('El portal solo administra tareas de su CRM');
            return undefined;
        }
        const lead = await this.leads.findOne({
            where: { id: entityId, organizationId: req.organizationId }, select: { id: true, clientId: true },
        });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        if (!await this.permissions.can(req.organizationId, req.user.id, req.user.role, 'crm', level)) {
            throw new common_1.ForbiddenException('No tienes acceso al CRM');
        }
        const clientId = lead.clientId ?? undefined;
        const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        if (!clientId && allowed !== undefined)
            throw new common_1.NotFoundException('Lead not found');
        await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
        await this.capabilities.assert(req.organizationId, clientId, 'crm');
        return clientId;
    }
};
exports.TasksController = TasksController;
__decorate([
    (0, common_1.Get)('mine'),
    (0, swagger_1.ApiOperation)({ summary: 'Lo que tengo pendiente, lo más vencido primero' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], TasksController.prototype, "mine", null);
__decorate([
    (0, common_1.Get)('agenda'),
    (0, swagger_1.ApiOperation)({ summary: 'Tareas que vencen en un rango, para el calendario' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "agenda", null);
__decorate([
    (0, common_1.Get)(':entityType/:entityId'),
    (0, swagger_1.ApiOperation)({ summary: 'Tareas de un registro' }),
    __param(0, (0, common_1.Param)('entityType')),
    __param(1, (0, common_1.Param)('entityId')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "forEntity", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Abrir una tarea sobre un registro' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [task_dto_1.CreateTaskDto, Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Completar, cancelar o reasignar una tarea' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, task_dto_1.UpdateTaskDto, Object]),
    __metadata("design:returntype", Promise)
], TasksController.prototype, "update", null);
exports.TasksController = TasksController = __decorate([
    (0, swagger_1.ApiTags)('Tareas'),
    (0, common_1.Controller)('tasks'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleExempt)('Trabajo asignado sobre registros de cinco módulos distintos; no pertenece a ninguno'),
    __param(1, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [tasks_service_1.TasksService,
        typeorm_2.Repository,
        account_access_service_1.AccountAccessService,
        client_capability_service_1.ClientCapabilityService,
        permission_resolver_service_1.PermissionResolverService])
], TasksController);
