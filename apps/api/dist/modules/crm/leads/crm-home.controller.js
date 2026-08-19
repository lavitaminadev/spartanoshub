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
exports.CrmHomeController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const roles_decorator_1 = require("../../../core/authorization/roles.decorator");
const module_scope_decorator_1 = require("../../../core/authorization/module-scope.decorator");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const crm_home_service_1 = require("./crm-home.service");
let CrmHomeController = class CrmHomeController {
    constructor(home) {
        this.home = home;
    }
    async get(req, coolingDays) {
        const dias = Math.min(Math.max(Number(coolingDays) || 7, 1), 90);
        return this.home.home(req.organizationId, dias);
    }
};
exports.CrmHomeController = CrmHomeController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Avisos y carga del equipo al entrar al CRM' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('coolingDays')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], CrmHomeController.prototype, "get", null);
exports.CrmHomeController = CrmHomeController = __decorate([
    (0, common_1.Controller)('crm/home'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    (0, module_scope_decorator_1.ModuleScope)('crm'),
    __metadata("design:paramtypes", [crm_home_service_1.CrmHomeService])
], CrmHomeController);
