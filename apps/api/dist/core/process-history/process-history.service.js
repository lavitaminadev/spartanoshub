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
var ProcessHistoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessHistoryService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const process_stage_change_entity_1 = require("./process-stage-change.entity");
let ProcessHistoryService = ProcessHistoryService_1 = class ProcessHistoryService {
    constructor(changes) {
        this.changes = changes;
        this.logger = new common_1.Logger(ProcessHistoryService_1.name);
    }
    async recordCreated(organizationId, subjectType, subjectId, stage, actorId) {
        await this.safely(() => this.changes.save(this.changes.create({
            organizationId,
            subjectType,
            subjectId,
            fromStage: null,
            toStage: stage,
            durationHours: null,
            changedBy: actorId ?? null,
        })), `apertura de ${subjectType} ${subjectId}`);
    }
    async recordStageChange(organizationId, subjectType, subjectId, previousStage, stage, actorId, reason) {
        if (previousStage === stage)
            return;
        await this.safely(async () => {
            await this.changes.save(this.changes.create({
                organizationId,
                subjectType,
                subjectId,
                fromStage: previousStage,
                toStage: stage,
                durationHours: await this.hoursSinceLastChange(subjectType, subjectId),
                changedBy: actorId ?? null,
                reason: reason ?? null,
            }));
        }, `cambio de etapa de ${subjectType} ${subjectId}`);
    }
    async timeline(subjectType, subjectId) {
        return this.changes.find({
            where: { subjectType, subjectId },
            order: { createdAt: 'ASC' },
        });
    }
    async stageDurations(organizationId, subjectType, since) {
        const query = this.changes.createQueryBuilder('change')
            .select('change.from_stage', 'stage')
            .addSelect('COUNT(*)', 'transitions')
            .addSelect('AVG(change.duration_hours)', 'averageHours')
            .where('change.organization_id = :organizationId', { organizationId })
            .andWhere('change.subject_type = :subjectType', { subjectType })
            .andWhere('change.from_stage IS NOT NULL')
            .andWhere('change.duration_hours IS NOT NULL')
            .groupBy('change.from_stage');
        if (since)
            query.andWhere('change.created_at >= :since', { since });
        const rows = await query.getRawMany();
        return rows.map((row) => ({
            stage: row.stage,
            transitions: Number(row.transitions),
            averageHours: Math.round(Number(row.averageHours) * 100) / 100,
        }));
    }
    async hoursSinceLastChange(subjectType, subjectId) {
        const last = await this.changes.findOne({
            where: { subjectType, subjectId },
            order: { createdAt: 'DESC' },
        });
        if (!last)
            return null;
        const hours = (Date.now() - last.createdAt.getTime()) / 3_600_000;
        return Math.round(hours * 100) / 100;
    }
    async safely(task, description) {
        try {
            await task();
        }
        catch (error) {
            this.logger.error(`No se pudo registrar la ${description}: ${error instanceof Error ? error.message : error}`);
        }
    }
};
exports.ProcessHistoryService = ProcessHistoryService;
exports.ProcessHistoryService = ProcessHistoryService = ProcessHistoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(process_stage_change_entity_1.ProcessStageChange)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], ProcessHistoryService);
