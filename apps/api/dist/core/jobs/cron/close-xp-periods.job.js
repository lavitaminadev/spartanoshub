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
var CloseXpPeriodsJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloseXpPeriodsJob = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const xp_period_entity_1 = require("../../../modules/gamification/xp-period.entity");
const xp_event_entity_1 = require("../../../modules/gamification/xp-event.entity");
const xp_calculator_1 = require("../../../modules/gamification/xp-calculator");
const xp_event_type_enum_1 = require("../../../modules/gamification/xp-event-type.enum");
let CloseXpPeriodsJob = CloseXpPeriodsJob_1 = class CloseXpPeriodsJob {
    constructor(periodRepo, eventRepo) {
        this.periodRepo = periodRepo;
        this.eventRepo = eventRepo;
        this.logger = new common_1.Logger(CloseXpPeriodsJob_1.name);
    }
    async handle() {
        this.logger.log('Closing weekly XP periods...');
        const now = new Date();
        const closeThrough = this.closeThrough(now);
        if (!closeThrough)
            return;
        const openPeriods = await this.periodRepo.find({
            where: { status: 'open', weekEnd: (0, typeorm_2.LessThanOrEqual)(closeThrough) },
        });
        for (const period of openPeriods) {
            try {
                const result = await this.eventRepo
                    .createQueryBuilder('e')
                    .select('COALESCE(SUM(e.points), 0)', 'total')
                    .where('e.xp_period_id = :periodId', { periodId: period.id })
                    .getRawOne();
                const penaltyCount = await this.eventRepo.count({ where: { xpPeriodId: period.id, eventType: xp_event_type_enum_1.XPEventType.CORRECTION_PENALTY } });
                if (penaltyCount === 0) {
                    await this.eventRepo.save(this.eventRepo.create({ xpPeriodId: period.id, userId: period.userId, eventType: xp_event_type_enum_1.XPEventType.NO_ERROR_WEEK_BONUS, points: 15, description: 'Semana cerrada sin correcciones atribuibles al diseñador' }));
                }
                const totalXp = Number(result?.total ?? 0) + (penaltyCount === 0 ? 15 : 0);
                const tier = (0, xp_calculator_1.calculateWeeklyTier)(totalXp);
                await this.periodRepo.update(period.id, {
                    status: 'closed',
                    totalXp,
                    tier: tier ?? undefined,
                    closedAt: new Date(),
                });
                this.logger.log(`Closed period ${period.id}: ${totalXp} XP, tier ${tier ?? 'none'}`);
            }
            catch (error) {
                this.logger.error(`Failed to close XP period ${period.id}: ${error instanceof Error ? error.message : error}`);
            }
        }
        this.logger.log(`Closed ${openPeriods.length} periods`);
    }
    closeThrough(date) {
        const current = new Date(date);
        const day = current.getDay();
        if (day === 5 && current.getHours() < 18) {
            current.setDate(current.getDate() - 7);
        }
        else if (day < 5 && day !== 0) {
            current.setDate(current.getDate() - (day + 2));
        }
        else if (day === 0) {
            current.setDate(current.getDate() - 2);
        }
        else if (day === 6) {
            current.setDate(current.getDate() - 1);
        }
        current.setHours(0, 0, 0, 0);
        return current;
    }
};
exports.CloseXpPeriodsJob = CloseXpPeriodsJob;
exports.CloseXpPeriodsJob = CloseXpPeriodsJob = CloseXpPeriodsJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(xp_period_entity_1.XPPeriod)),
    __param(1, (0, typeorm_1.InjectRepository)(xp_event_entity_1.XPEvent)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], CloseXpPeriodsJob);
