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
exports.RegisterXpUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const xp_period_entity_1 = require("./xp-period.entity");
const xp_event_entity_1 = require("./xp-event.entity");
const xp_event_type_enum_1 = require("./xp-event-type.enum");
const xp_calculator_1 = require("./xp-calculator");
const user_entity_1 = require("../users/user.entity");
let RegisterXpUseCase = class RegisterXpUseCase {
    constructor(periodRepo, eventRepo) {
        this.periodRepo = periodRepo;
        this.eventRepo = eventRepo;
    }
    async assertUserBelongsToOrganization(manager, userId, organizationId) {
        const exists = await manager.getRepository(user_entity_1.User).exist({ where: { id: userId, organizationId } });
        if (!exists)
            throw new common_1.NotFoundException('Usuario no encontrado');
    }
    async executeDelivery(params, transactionManager) {
        const execute = async (manager) => {
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
            weekStart.setHours(0, 0, 0, 0);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 4);
            await this.assertUserBelongsToOrganization(manager, params.userId, params.organizationId);
            let period = await manager.findOne(xp_period_entity_1.XPPeriod, {
                where: { userId: params.userId, weekStart, organizationId: params.organizationId },
            });
            if (!period) {
                period = manager.create(xp_period_entity_1.XPPeriod, {
                    organizationId: params.organizationId,
                    userId: params.userId,
                    weekStart,
                    weekEnd,
                });
                period = await manager.save(xp_period_entity_1.XPPeriod, period);
            }
            const points = (0, xp_calculator_1.calculateDeliveryXp)(params);
            const event = manager.create(xp_event_entity_1.XPEvent, {
                xpPeriodId: period.id,
                userId: params.userId,
                pieceId: params.pieceId,
                eventType: xp_event_type_enum_1.XPEventType.BASE_DELIVERY,
                points,
                description: params.description,
                metadata: params.metadata,
            });
            await manager.save(xp_event_entity_1.XPEvent, event);
            period.totalXp = Number(period.totalXp) + points;
            period.tier = (0, xp_calculator_1.calculateWeeklyTier)(period.totalXp) ?? undefined;
            return manager.save(xp_period_entity_1.XPPeriod, period);
        };
        return transactionManager ? execute(transactionManager) : this.periodRepo.manager.transaction(execute);
    }
    async executePenalty(params, transactionManager) {
        const execute = async (manager) => {
            const now = new Date();
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
            weekStart.setHours(0, 0, 0, 0);
            await this.assertUserBelongsToOrganization(manager, params.userId, params.organizationId);
            let period = await manager.findOne(xp_period_entity_1.XPPeriod, {
                where: { userId: params.userId, weekStart, organizationId: params.organizationId },
            });
            if (!period) {
                period = manager.create(xp_period_entity_1.XPPeriod, { organizationId: params.organizationId, userId: params.userId, weekStart, weekEnd: new Date(weekStart.getTime() + 4 * 86400000) });
                period = await manager.save(xp_period_entity_1.XPPeriod, period);
            }
            const event = manager.create(xp_event_entity_1.XPEvent, {
                xpPeriodId: period.id,
                userId: params.userId,
                pieceId: params.pieceId,
                eventType: params.eventType,
                points: params.points,
            });
            await manager.save(xp_event_entity_1.XPEvent, event);
            period.totalXp = Math.max(0, Number(period.totalXp) + params.points);
            period.tier = (0, xp_calculator_1.calculateWeeklyTier)(period.totalXp) ?? undefined;
            return manager.save(xp_period_entity_1.XPPeriod, period);
        };
        return transactionManager ? execute(transactionManager) : this.periodRepo.manager.transaction(execute);
    }
};
exports.RegisterXpUseCase = RegisterXpUseCase;
exports.RegisterXpUseCase = RegisterXpUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(xp_period_entity_1.XPPeriod)),
    __param(1, (0, typeorm_1.InjectRepository)(xp_event_entity_1.XPEvent)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], RegisterXpUseCase);
//# sourceMappingURL=register-xp.use-case.js.map