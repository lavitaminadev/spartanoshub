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
exports.AccountCyclesController = void 0;
const common_1 = require("@nestjs/common");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const account_cycles_service_1 = require("./account-cycles.service");
const update_account_cycle_dto_1 = require("./dto/update-account-cycle.dto");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let AccountCyclesController = class AccountCyclesController {
    constructor(service, accountAccess) {
        this.service = service;
        this.accountAccess = accountAccess;
    }
    async list(req, year, month) {
        const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.service.list(req.organizationId, year ? Number(year) : undefined, month ? Number(month) : undefined, clientIds);
    }
    async update(id, patch, req) {
        const clientIds = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.service.update(id, req.organizationId, patch, clientIds);
    }
};
exports.AccountCyclesController = AccountCyclesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('year')),
    __param(2, (0, common_1.Query)('month')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], AccountCyclesController.prototype, "list", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_account_cycle_dto_1.UpdateAccountCycleDto, Object]),
    __metadata("design:returntype", Promise)
], AccountCyclesController.prototype, "update", null);
exports.AccountCyclesController = AccountCyclesController = __decorate([
    (0, common_1.Controller)('account-cycles'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.COMMUNITY_MANAGER, user_role_enum_1.UserRole.CREATIVE_DIRECTOR),
    (0, module_scope_decorator_1.ModuleScope)('clients'),
    __metadata("design:paramtypes", [account_cycles_service_1.AccountCyclesService,
        account_access_service_1.AccountAccessService])
], AccountCyclesController);
