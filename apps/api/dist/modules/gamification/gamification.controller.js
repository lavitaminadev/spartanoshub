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
exports.GamificationController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const passport_1 = require("@nestjs/passport");
const register_xp_use_case_1 = require("./register-xp.use-case");
const get_weekly_ranking_use_case_1 = require("./get-weekly-ranking.use-case");
const register_delivery_dto_1 = require("./dto/register-delivery.dto");
const register_penalty_dto_1 = require("./dto/register-penalty.dto");
const roles_decorator_1 = require("../../core/authorization/roles.decorator");
const user_role_enum_1 = require("../organizations/user-role.enum");
const xp_disputes_service_1 = require("./xp-disputes.service");
const xp_dispute_dto_1 = require("./dto/xp-dispute.dto");
const requires_feature_decorator_1 = require("../../core/authorization/requires-feature.decorator");
let GamificationController = class GamificationController {
    constructor(registerXp, ranking, disputes) {
        this.registerXp = registerXp;
        this.ranking = ranking;
        this.disputes = disputes;
    }
    registerDelivery(dto, req) {
        return this.registerXp.executeDelivery({ ...dto, organizationId: req.organizationId });
    }
    registerPenalty(dto, req) {
        return this.registerXp.executePenalty({ ...dto, organizationId: req.organizationId });
    }
    getRanking(req) {
        return this.ranking.execute(req.organizationId);
    }
    listDisputes(req) { return this.disputes.list(req.organizationId, req.user.id, req.user.role); }
    createDispute(req, dto) { return this.disputes.create(req.organizationId, req.user.id, dto); }
    resolveDispute(req, id, dto) { return this.disputes.resolve(id, req.organizationId, req.user.id, dto); }
};
exports.GamificationController = GamificationController;
__decorate([
    (0, common_1.Post)('xp/delivery'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Registrar XP por entrega a tiempo' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_delivery_dto_1.RegisterDeliveryDto, Object]),
    __metadata("design:returntype", void 0)
], GamificationController.prototype, "registerDelivery", null);
__decorate([
    (0, common_1.Post)('xp/penalty'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.ADMIN),
    (0, swagger_1.ApiOperation)({ summary: 'Registrar penalización de XP' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [register_penalty_dto_1.RegisterPenaltyDto, Object]),
    __metadata("design:returntype", void 0)
], GamificationController.prototype, "registerPenalty", null);
__decorate([
    (0, common_1.Get)('ranking'),
    (0, swagger_1.ApiOperation)({ summary: 'Obtener ranking semanal de XP' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GamificationController.prototype, "getRanking", null);
__decorate([
    (0, common_1.Get)('disputes'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], GamificationController.prototype, "listDisputes", null);
__decorate([
    (0, common_1.Post)('disputes'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, xp_dispute_dto_1.CreateXpDisputeDto]),
    __metadata("design:returntype", void 0)
], GamificationController.prototype, "createDispute", null);
__decorate([
    (0, common_1.Put)('disputes/:id/resolve'),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, xp_dispute_dto_1.ResolveXpDisputeDto]),
    __metadata("design:returntype", void 0)
], GamificationController.prototype, "resolveDispute", null);
exports.GamificationController = GamificationController = __decorate([
    (0, swagger_1.ApiTags)('Gamificación'),
    (0, common_1.Controller)('gamification'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)('jwt')),
    (0, swagger_1.ApiBearerAuth)(),
    (0, roles_decorator_1.Roles)(user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.DESIGNER, user_role_enum_1.UserRole.AUDIOVISUAL),
    (0, requires_feature_decorator_1.RequiresFeature)('gamification'),
    __metadata("design:paramtypes", [register_xp_use_case_1.RegisterXpUseCase,
        get_weekly_ranking_use_case_1.GetWeeklyRankingUseCase,
        xp_disputes_service_1.XpDisputesService])
], GamificationController);
