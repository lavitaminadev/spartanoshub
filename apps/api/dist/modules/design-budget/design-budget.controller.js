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
exports.DesignBudgetController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const get_or_create_budget_use_case_1 = require("./get-or-create-budget.use-case");
const reserve_ud_use_case_1 = require("./reserve-ud.use-case");
const confirm_ud_consumption_use_case_1 = require("./confirm-ud-consumption.use-case");
const get_or_create_budget_dto_1 = require("./dto/get-or-create-budget.dto");
const reserve_ud_dto_1 = require("./dto/reserve-ud.dto");
const confirm_ud_dto_1 = require("./dto/confirm-ud.dto");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const account_access_service_1 = require("../../core/client-scope/account-access.service");
const module_scope_decorator_1 = require("../../core/authorization/module-scope.decorator");
let DesignBudgetController = class DesignBudgetController {
    constructor(getOrCreate, reserve, confirm, accountAccess) {
        this.getOrCreate = getOrCreate;
        this.reserve = reserve;
        this.confirm = confirm;
        this.accountAccess = accountAccess;
    }
    async getOrCreateBudget(dto, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        return this.getOrCreate.execute(req.organizationId, dto.clientId, dto.year, dto.month, dto.defaultBudget);
    }
    async reserveUd(dto, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        return this.reserve.execute(req.organizationId, dto.clientId, dto.pieceId, dto.amount, dto.year, dto.month);
    }
    async confirmUd(dto, req) {
        await this.accountAccess.assertClient(req.organizationId, req.user, dto.clientId);
        return this.confirm.execute(req.organizationId, dto.clientId, dto.pieceId, dto.year, dto.month);
    }
};
exports.DesignBudgetController = DesignBudgetController;
__decorate([
    (0, common_1.Post)('budget'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.OPERATIONS_DIRECTOR, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener o crear presupuesto UD del mes' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_or_create_budget_dto_1.GetOrCreateBudgetDto, Object]),
    __metadata("design:returntype", Promise)
], DesignBudgetController.prototype, "getOrCreateBudget", null);
__decorate([
    (0, common_1.Post)('reserve'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Reservar UDs para una pieza' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [reserve_ud_dto_1.ReserveUdDto, Object]),
    __metadata("design:returntype", Promise)
], DesignBudgetController.prototype, "reserveUd", null);
__decorate([
    (0, common_1.Post)('confirm'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Confirmar consumo de UDs' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [confirm_ud_dto_1.ConfirmUdDto, Object]),
    __metadata("design:returntype", Promise)
], DesignBudgetController.prototype, "confirmUd", null);
exports.DesignBudgetController = DesignBudgetController = __decorate([
    (0, swagger_1.ApiTags)('Presupuesto UD'),
    (0, common_1.Controller)('design-budget'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, module_scope_decorator_1.ModuleScope)('udBudget'),
    __metadata("design:paramtypes", [get_or_create_budget_use_case_1.GetOrCreateBudgetUseCase,
        reserve_ud_use_case_1.ReserveUdUseCase,
        confirm_ud_consumption_use_case_1.ConfirmUdConsumptionUseCase,
        account_access_service_1.AccountAccessService])
], DesignBudgetController);
//# sourceMappingURL=design-budget.controller.js.map