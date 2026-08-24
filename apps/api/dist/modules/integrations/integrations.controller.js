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
exports.IntegrationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const create_integration_use_case_1 = require("./create-integration.use-case");
const list_integrations_use_case_1 = require("./list-integrations.use-case");
const update_integration_use_case_1 = require("./update-integration.use-case");
const create_integration_dto_1 = require("./dto/create-integration.dto");
const update_integration_dto_1 = require("./dto/update-integration.dto");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const integration_accounts_service_1 = require("./integration-accounts.service");
const assign_integration_client_dto_1 = require("./dto/assign-integration-client.dto");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let IntegrationsController = class IntegrationsController {
    constructor(createIntegration, listIntegrations, updateIntegration, accounts) {
        this.createIntegration = createIntegration;
        this.listIntegrations = listIntegrations;
        this.updateIntegration = updateIntegration;
        this.accounts = accounts;
    }
    create(dto, req) {
        return this.createIntegration.execute({ ...dto, organizationId: req.organizationId, name: dto.name || dto.provider });
    }
    list(provider, req) {
        return this.listIntegrations.execute(req.organizationId, provider);
    }
    update(id, dto, req) {
        return this.updateIntegration.execute(id, dto, req.organizationId);
    }
    assignClient(accountId, dto, req) {
        return this.accounts.assignClient(accountId, dto.clientId, req.organizationId);
    }
};
exports.IntegrationsController = IntegrationsController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Crear una nueva integración' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_integration_dto_1.CreateIntegrationDto, Object]),
    __metadata("design:returntype", void 0)
], IntegrationsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Listar integraciones' }),
    __param(0, (0, common_1.Query)('provider')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], IntegrationsController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar estado de una integración' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_integration_dto_1.UpdateIntegrationDto, Object]),
    __metadata("design:returntype", void 0)
], IntegrationsController.prototype, "update", null);
__decorate([
    (0, common_1.Put)('accounts/:accountId/client'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR),
    (0, swagger_1.ApiOperation)({ summary: 'Asignar un activo externo a un cliente' }),
    __param(0, (0, common_1.Param)('accountId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, assign_integration_client_dto_1.AssignIntegrationClientDto, Object]),
    __metadata("design:returntype", void 0)
], IntegrationsController.prototype, "assignClient", null);
exports.IntegrationsController = IntegrationsController = __decorate([
    (0, swagger_1.ApiTags)('Integraciones'),
    (0, common_1.Controller)('integrations'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('integrations'),
    __metadata("design:paramtypes", [create_integration_use_case_1.CreateIntegrationUseCase,
        list_integrations_use_case_1.ListIntegrationsUseCase,
        update_integration_use_case_1.UpdateIntegrationUseCase,
        integration_accounts_service_1.IntegrationAccountsService])
], IntegrationsController);
