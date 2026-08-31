"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParametersModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const parameter_definition_entity_1 = require("./parameter-definition.entity");
const parameter_value_entity_1 = require("./parameter-value.entity");
const parameter_resolver_service_1 = require("./parameter-resolver.service");
const audit_module_1 = require("../audit/audit.module");
const organization_settings_controller_1 = require("./organization-settings.controller");
const organization_settings_service_1 = require("./organization-settings.service");
const email_module_1 = require("../notifications/email.module");
const user_entity_1 = require("../../modules/users/user.entity");
let ParametersModule = class ParametersModule {
};
exports.ParametersModule = ParametersModule;
exports.ParametersModule = ParametersModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([parameter_definition_entity_1.ParameterDefinition, parameter_value_entity_1.ParameterValue, user_entity_1.User]), audit_module_1.AuditModule, email_module_1.EmailModule],
        controllers: [organization_settings_controller_1.OrganizationSettingsController],
        providers: [parameter_resolver_service_1.ParameterResolver, organization_settings_service_1.OrganizationSettingsService],
        exports: [parameter_resolver_service_1.ParameterResolver, organization_settings_service_1.OrganizationSettingsService, typeorm_1.TypeOrmModule],
    })
], ParametersModule);
