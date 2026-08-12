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
exports.OrganizationSettingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../authorization/roles.decorator");
const user_role_enum_1 = require("../../modules/organizations/user-role.enum");
const update_organization_settings_dto_1 = require("./dto/update-organization-settings.dto");
const organization_settings_service_1 = require("./organization-settings.service");
const module_scope_decorator_1 = require("../authorization/module-scope.decorator");
let OrganizationSettingsController = class OrganizationSettingsController {
    constructor(settings) {
        this.settings = settings;
    }
    list(request) {
        return this.settings.list(request.organizationId || request.user.organizationId);
    }
    update(request, dto) {
        return this.settings.update(request.organizationId || request.user.organizationId, request.user.id, dto.values);
    }
};
exports.OrganizationSettingsController = OrganizationSettingsController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener configuración efectiva de la organización' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OrganizationSettingsController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(),
    (0, swagger_1.ApiOperation)({ summary: 'Actualizar y auditar configuración de la organización' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_organization_settings_dto_1.UpdateOrganizationSettingsDto]),
    __metadata("design:returntype", void 0)
], OrganizationSettingsController.prototype, "update", null);
exports.OrganizationSettingsController = OrganizationSettingsController = __decorate([
    (0, swagger_1.ApiTags)('Configuración'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('settings'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, module_scope_decorator_1.ModuleScope)('settings'),
    __metadata("design:paramtypes", [organization_settings_service_1.OrganizationSettingsService])
], OrganizationSettingsController);
