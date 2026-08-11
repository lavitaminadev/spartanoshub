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
exports.XpDisputesService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const user_role_enum_1 = require("../organizations/user-role.enum");
const xp_calculator_1 = require("./xp-calculator");
const xp_dispute_entity_1 = require("./xp-dispute.entity");
const xp_event_entity_1 = require("./xp-event.entity");
const xp_event_type_enum_1 = require("./xp-event-type.enum");
const xp_period_entity_1 = require("./xp-period.entity");
let XpDisputesService = class XpDisputesService {
    constructor(disputes, periods) {
        this.disputes = disputes;
        this.periods = periods;
    }
    list(organizationId, userId, role) {
        const canResolve = [user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.ART_DIRECTOR, user_role_enum_1.UserRole.AV_DIRECTOR, user_role_enum_1.UserRole.OPERATIONS_DIRECTOR].includes(role);
        return this.disputes.find({ where: { organizationId, ...(canResolve ? {} : { userId }) }, relations: ['user', 'period'], order: { createdAt: 'DESC' }, take: 100 });
    }
    async create(organizationId, userId, dto) {
        const period = await this.periods.findOne({ where: { id: dto.xpPeriodId, organizationId, userId } });
        if (!period)
            throw new common_1.NotFoundException('Período XP no encontrado');
        const pending = await this.disputes.findOne({ where: { organizationId, xpPeriodId: period.id, userId, status: 'pending' } });
        if (pending)
            throw new common_1.BadRequestException('Ya existe una revisión pendiente para este período');
        return this.disputes.save(this.disputes.create({ organizationId, xpPeriodId: period.id, userId, message: dto.message.trim(), status: 'pending' }));
    }
    async resolve(id, organizationId, actorId, dto) {
        return this.disputes.manager.transaction(async (manager) => {
            const dispute = await manager.findOne(xp_dispute_entity_1.XPDispute, { where: { id, organizationId }, lock: { mode: 'pessimistic_write' } });
            if (!dispute)
                throw new common_1.NotFoundException('Solicitud de revisión no encontrada');
            if (dispute.status !== 'pending')
                throw new common_1.BadRequestException('La solicitud ya fue resuelta');
            dispute.status = dto.status;
            dispute.resolution = dto.resolution.trim();
            dispute.adjustmentPoints = dto.status === 'accepted' ? dto.adjustmentPoints : 0;
            dispute.resolvedBy = actorId;
            dispute.resolvedAt = new Date();
            if (dispute.adjustmentPoints !== 0) {
                const period = await manager.findOne(xp_period_entity_1.XPPeriod, { where: { id: dispute.xpPeriodId, organizationId }, lock: { mode: 'pessimistic_write' } });
                if (!period)
                    throw new common_1.NotFoundException('Período XP no encontrado');
                await manager.save(xp_event_entity_1.XPEvent, manager.create(xp_event_entity_1.XPEvent, { xpPeriodId: period.id, userId: dispute.userId, eventType: xp_event_type_enum_1.XPEventType.MANUAL_ADJUSTMENT, points: dispute.adjustmentPoints, description: dispute.resolution, metadata: { disputeId: dispute.id, resolvedBy: actorId } }));
                period.totalXp = Math.max(0, Number(period.totalXp) + dispute.adjustmentPoints);
                period.tier = (0, xp_calculator_1.calculateWeeklyTier)(period.totalXp) ?? undefined;
                await manager.save(xp_period_entity_1.XPPeriod, period);
            }
            return manager.save(xp_dispute_entity_1.XPDispute, dispute);
        });
    }
};
exports.XpDisputesService = XpDisputesService;
exports.XpDisputesService = XpDisputesService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(xp_dispute_entity_1.XPDispute)),
    __param(1, (0, typeorm_1.InjectRepository)(xp_period_entity_1.XPPeriod)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], XpDisputesService);
//# sourceMappingURL=xp-disputes.service.js.map