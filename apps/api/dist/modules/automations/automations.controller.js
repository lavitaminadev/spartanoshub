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
exports.AutomationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const automations_service_1 = require("./automations.service");
const save_automation_dto_1 = require("./dto/save-automation.dto");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
let AutomationsController = class AutomationsController {
    constructor(automations, accountAccess) {
        this.automations = automations;
        this.accountAccess = accountAccess;
    }
    catalog() {
        return this.automations.catalog();
    }
    list(req) {
        return this.automations.list(req.organizationId);
    }
    get(id, req) {
        return this.automations.get(id, req.organizationId);
    }
    async create(dto, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId ?? undefined);
        return this.automations.create(req.organizationId, dto, req.user.id);
    }
    async update(id, dto, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId ?? undefined);
        return this.automations.update(id, req.organizationId, dto);
    }
    setActive(id, dto, req) {
        return this.automations.setActive(id, req.organizationId, dto.isActive);
    }
    remove(id, req) {
        return this.automations.remove(id, req.organizationId);
    }
    runs(id, limit, req) {
        return this.automations.listRuns(id, req.organizationId, limit ? Number(limit) : undefined);
    }
    runDetail(runId, req) {
        return this.automations.runDetail(runId, req.organizationId);
    }
};
exports.AutomationsController = AutomationsController;
__decorate([
    (0, common_1.Get)('catalog'),
    (0, swagger_1.ApiOperation)({ summary: 'Disparadores y acciones disponibles para el editor' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "catalog", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Listar automatizaciones' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Ver una automatización con su flujo' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "get", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Crear una automatización (nace desactivada)' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [save_automation_dto_1.SaveAutomationDto, Object]),
    __metadata("design:returntype", Promise)
], AutomationsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar el flujo de una automatización' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, save_automation_dto_1.SaveAutomationDto, Object]),
    __metadata("design:returntype", Promise)
], AutomationsController.prototype, "update", null);
__decorate([
    (0, common_1.Post)(':id/active'),
    (0, swagger_1.ApiOperation)({ summary: 'Activar o desactivar una automatización' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, save_automation_dto_1.SetAutomationActiveDto, Object]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "setActive", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, swagger_1.ApiOperation)({ summary: 'Eliminar una automatización' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "remove", null);
__decorate([
    (0, common_1.Get)(':id/runs'),
    (0, swagger_1.ApiOperation)({ summary: 'Ejecuciones recientes de una automatización' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "runs", null);
__decorate([
    (0, common_1.Get)('runs/:runId'),
    (0, swagger_1.ApiOperation)({ summary: 'Detalle de una ejecución, paso a paso' }),
    __param(0, (0, common_1.Param)('runId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AutomationsController.prototype, "runDetail", null);
exports.AutomationsController = AutomationsController = __decorate([
    (0, swagger_1.ApiTags)('Automatizaciones'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('automations'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.DEV),
    (0, module_scope_decorator_1.ModuleScope)('commercialPipeline'),
    __metadata("design:paramtypes", [automations_service_1.AutomationsService,
        account_access_service_1.AccountAccessService])
], AutomationsController);
