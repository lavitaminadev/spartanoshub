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
exports.OpportunitiesController = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const create_opportunity_use_case_1 = require("./use-cases/create-opportunity.use-case");
const list_opportunities_use_case_1 = require("./use-cases/list-opportunities.use-case");
const get_opportunity_use_case_1 = require("./use-cases/get-opportunity.use-case");
const update_opportunity_use_case_1 = require("./use-cases/update-opportunity.use-case");
const remove_opportunity_use_case_1 = require("./use-cases/remove-opportunity.use-case");
const create_opportunity_dto_1 = require("./dto/create-opportunity.dto");
const update_opportunity_dto_1 = require("./dto/update-opportunity.dto");
const list_opportunities_dto_1 = require("./dto/list-opportunities.dto");
const roles_decorator_1 = require("../../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../../organizations/user-role.enum");
const requires_feature_decorator_1 = require("../../../core/authorization/requires-feature.decorator");
const account_access_service_1 = require("../../../core/client-scope/account-access.service");
let OpportunitiesController = class OpportunitiesController {
    constructor(createOpportunity, listOpportunities, getOpportunity, updateOpportunity, removeOpportunity, accountAccess) {
        this.createOpportunity = createOpportunity;
        this.listOpportunities = listOpportunities;
        this.getOpportunity = getOpportunity;
        this.updateOpportunity = updateOpportunity;
        this.removeOpportunity = removeOpportunity;
        this.accountAccess = accountAccess;
    }
    create(dto, req) {
        return this.createOpportunity.execute(dto, req.organizationId);
    }
    async findAll(query, req) {
        const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.listOpportunities.execute(req.organizationId, query.limit, query.offset, query.leadId, allowed);
    }
    async findOne(id, req) {
        const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
        return this.getOpportunity.execute(id, req.organizationId, allowed);
    }
    update(id, dto, req) {
        return this.updateOpportunity.execute(id, dto, req.organizationId);
    }
    remove(id, req) {
        return this.removeOpportunity.execute(id, req.organizationId);
    }
};
exports.OpportunitiesController = OpportunitiesController;
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_opportunity_dto_1.CreateOpportunityDto, Object]),
    __metadata("design:returntype", void 0)
], OpportunitiesController.prototype, "create", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [list_opportunities_dto_1.ListOpportunitiesDto, Object]),
    __metadata("design:returntype", Promise)
], OpportunitiesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], OpportunitiesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Put)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, update_opportunity_dto_1.UpdateOpportunityDto, Object]),
    __metadata("design:returntype", void 0)
], OpportunitiesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], OpportunitiesController.prototype, "remove", null);
exports.OpportunitiesController = OpportunitiesController = __decorate([
    (0, common_1.Controller)('crm/opportunities'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, requires_feature_decorator_1.RequiresFeature)('commercialPipeline'),
    __metadata("design:paramtypes", [create_opportunity_use_case_1.CreateOpportunityUseCase,
        list_opportunities_use_case_1.ListOpportunitiesUseCase,
        get_opportunity_use_case_1.GetOpportunityUseCase,
        update_opportunity_use_case_1.UpdateOpportunityUseCase,
        remove_opportunity_use_case_1.RemoveOpportunityUseCase,
        account_access_service_1.AccountAccessService])
], OpportunitiesController);
//# sourceMappingURL=opportunities.controller.js.map