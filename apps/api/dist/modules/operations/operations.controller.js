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
exports.OperationsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const get_operations_overview_use_case_1 = require("./get-operations-overview.use-case");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let OperationsController = class OperationsController {
    constructor(overview) {
        this.overview = overview;
    }
    getOverview(req) {
        return this.overview.execute(req.organizationId);
    }
};
exports.OperationsController = OperationsController;
__decorate([
    (0, common_1.Get)('overview'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.CREATIVE_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.AI_LEAD, user_role_enum_1.UserRole.COMMUNITY_MANAGER),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener vista general de operaciones' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], OperationsController.prototype, "getOverview", null);
exports.OperationsController = OperationsController = __decorate([
    (0, swagger_1.ApiTags)('Operaciones'),
    (0, common_1.Controller)('operations'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('operations'),
    __metadata("design:paramtypes", [get_operations_overview_use_case_1.GetOperationsOverviewUseCase])
], OperationsController);
//# sourceMappingURL=operations.controller.js.map