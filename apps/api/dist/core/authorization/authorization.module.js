"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthorizationModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const core_1 = require("@nestjs/core");
const organization_entity_1 = require("../../modules/organizations/organization.entity");
const user_entity_1 = require("../../modules/users/user.entity");
const client_entity_1 = require("../../modules/clients/client.entity");
const user_permission_override_entity_1 = require("./user-permission-override.entity");
const role_permission_override_entity_1 = require("./role-permission-override.entity");
const user_client_access_entity_1 = require("../client-scope/user-client-access.entity");
const permission_resolver_service_1 = require("./permission-resolver.service");
const permission_guard_1 = require("./permission.guard");
const permissions_controller_1 = require("./permissions.controller");
const audit_module_1 = require("../audit/audit.module");
const parameters_module_1 = require("../parameters/parameters.module");
let AuthorizationModule = class AuthorizationModule {
};
exports.AuthorizationModule = AuthorizationModule;
exports.AuthorizationModule = AuthorizationModule = __decorate([
    (0, common_1.Module)({
        imports: [
            typeorm_1.TypeOrmModule.forFeature([organization_entity_1.Organization, user_entity_1.User, client_entity_1.Client, user_permission_override_entity_1.UserPermissionOverride, role_permission_override_entity_1.RolePermissionOverride, user_client_access_entity_1.UserClientAccess]),
            audit_module_1.AuditModule,
            parameters_module_1.ParametersModule,
        ],
        controllers: [permissions_controller_1.PermissionsController],
        providers: [
            permission_resolver_service_1.PermissionResolverService,
            { provide: core_1.APP_GUARD, useClass: permission_guard_1.PermissionGuard },
        ],
        exports: [permission_resolver_service_1.PermissionResolverService, typeorm_1.TypeOrmModule],
    })
], AuthorizationModule);
