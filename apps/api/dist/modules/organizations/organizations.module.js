"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const organization_entity_1 = require("./organization.entity");
const organizations_controller_1 = require("./organizations.controller");
const create_organization_use_case_1 = require("./create-organization.use-case");
const list_organizations_use_case_1 = require("./list-organizations.use-case");
const auth_module_1 = require("../../core/auth/auth.module");
const audit_module_1 = require("../../core/audit/audit.module");
let OrganizationsModule = class OrganizationsModule {
};
exports.OrganizationsModule = OrganizationsModule;
exports.OrganizationsModule = OrganizationsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([organization_entity_1.Organization]), (0, common_1.forwardRef)(() => auth_module_1.AuthModule), audit_module_1.AuditModule],
        controllers: [organizations_controller_1.OrganizationsController],
        providers: [create_organization_use_case_1.CreateOrganizationUseCase, list_organizations_use_case_1.ListOrganizationsUseCase],
        exports: [typeorm_1.TypeOrmModule],
    })
], OrganizationsModule);
//# sourceMappingURL=organizations.module.js.map