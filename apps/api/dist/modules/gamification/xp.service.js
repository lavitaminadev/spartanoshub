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
exports.XPService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const xp_period_entity_1 = require("./xp-period.entity");
const xp_event_entity_1 = require("./xp-event.entity");
const xp_event_type_enum_1 = require("./xp-event-type.enum");
const register_xp_use_case_1 = require("./register-xp.use-case");
const xp_calculator_1 = require("./xp-calculator");
let XPService = class XPService {
    constructor(periodRepo, eventRepo, registerXp) {
        this.periodRepo = periodRepo;
        this.eventRepo = eventRepo;
        this.registerXp = registerXp;
    }
    async registerDelivery(piece, designerId, deliveredAt, manager) {
        const level = piece.difficultyLevel ?? 1;
        const expectedHours = this.expectedHoursForLevel(level);
        const elapsedHours = this.hoursDiff(piece.startedAt ?? piece.assignedAt ?? piece.createdAt, deliveredAt);
        const queryManager = manager ?? this.eventRepo.manager;
        const namingValid = await queryManager
            .createQueryBuilder()
            .select('pv.naming_valid', 'valid')
            .from('piece_versions', 'pv')
            .where('pv.piece_id = :pieceId', { pieceId: piece.id })
            .andWhere('pv.naming_valid IS NOT NULL')
            .orderBy('pv.version_number', 'DESC')
            .getRawOne();
        const hadDesignerError = await queryManager
            .createQueryBuilder()
            .select('1')
            .from('corrections', 'c')
            .where('c.piece_id = :pieceId', { pieceId: piece.id })
            .andWhere('c.origin = :origin', { origin: 'designer_error' })
            .getRawOne();
        await this.registerXp.executeDelivery({
            organizationId: piece.organizationId,
            userId: designerId,
            pieceId: piece.id,
            difficultyLevel: level,
            actualHours: elapsedHours,
            expectedHours,
            perfectNaming: namingValid?.valid === true,
            hadDesignerErrorCorrection: !!hadDesignerError,
        }, manager);
    }
    async registerDesignerErrorPenalty(piece, designerId, manager) {
        await this.registerXp.executePenalty({
            organizationId: piece.organizationId,
            userId: designerId,
            pieceId: piece.id,
            points: -5,
            eventType: xp_event_type_enum_1.XPEventType.CORRECTION_PENALTY,
        }, manager);
    }
    async ensurePeriod(userId, date) {
        const start = this.startOfWeek(date);
        const end = this.endOfWeek(date);
        const existing = await this.periodRepo.findOne({ where: { userId, weekStart: start } });
        if (existing)
            return existing;
        const period = this.periodRepo.create({
            userId,
            weekStart: start,
            weekEnd: end,
            status: 'open',
            totalXp: 0,
        });
        return this.periodRepo.save(period);
    }
    expectedHoursForLevel(level) {
        return xp_calculator_1.EXPECTED_HOURS[level] ?? 1;
    }
    startOfWeek(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }
    endOfWeek(date) {
        const d = this.startOfWeek(date);
        d.setDate(d.getDate() + 4);
        d.setHours(18, 0, 0, 0);
        return d;
    }
    hoursDiff(a, b) {
        return Math.abs(b.getTime() - a.getTime()) / 36_000_000;
    }
};
exports.XPService = XPService;
exports.XPService = XPService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(xp_period_entity_1.XPPeriod)),
    __param(1, (0, typeorm_1.InjectRepository)(xp_event_entity_1.XPEvent)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        register_xp_use_case_1.RegisterXpUseCase])
], XPService);
