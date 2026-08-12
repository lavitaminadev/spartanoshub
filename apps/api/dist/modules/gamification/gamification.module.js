"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamificationModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const xp_period_entity_1 = require("./xp-period.entity");
const xp_event_entity_1 = require("./xp-event.entity");
const gamification_controller_1 = require("./gamification.controller");
const register_xp_use_case_1 = require("./register-xp.use-case");
const get_weekly_ranking_use_case_1 = require("./get-weekly-ranking.use-case");
const xp_service_1 = require("./xp.service");
const xp_dispute_entity_1 = require("./xp-dispute.entity");
const xp_disputes_service_1 = require("./xp-disputes.service");
let GamificationModule = class GamificationModule {
};
exports.GamificationModule = GamificationModule;
exports.GamificationModule = GamificationModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([xp_period_entity_1.XPPeriod, xp_event_entity_1.XPEvent, xp_dispute_entity_1.XPDispute])],
        controllers: [gamification_controller_1.GamificationController],
        providers: [register_xp_use_case_1.RegisterXpUseCase, get_weekly_ranking_use_case_1.GetWeeklyRankingUseCase, xp_service_1.XPService, xp_disputes_service_1.XpDisputesService],
        exports: [xp_service_1.XPService, typeorm_1.TypeOrmModule],
    })
], GamificationModule);
