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
var OpportunityStageHistoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpportunityStageHistoryService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const opportunity_stage_change_entity_1 = require("./opportunity-stage-change.entity");
const CLOSING_STAGES = new Set(['won', 'lost']);
let OpportunityStageHistoryService = OpportunityStageHistoryService_1 = class OpportunityStageHistoryService {
    constructor(changes, events) {
        this.changes = changes;
        this.events = events;
        this.logger = new common_1.Logger(OpportunityStageHistoryService_1.name);
    }
    async recordCreated(opportunity, actorId) {
        await this.safely(async () => {
            await this.changes.save(this.changes.create({
                organizationId: opportunity.organizationId,
                opportunityId: opportunity.id,
                fromStage: null,
                toStage: opportunity.stage,
                durationHours: null,
                changedBy: actorId ?? null,
            }));
            this.emit('deal.created', opportunity, undefined, actorId);
        }, `apertura del trato ${opportunity.id}`);
    }
    async recordStageChange(opportunity, previousStage, actorId) {
        if (previousStage === opportunity.stage)
            return;
        await this.safely(async () => {
            await this.changes.save(this.changes.create({
                organizationId: opportunity.organizationId,
                opportunityId: opportunity.id,
                fromStage: previousStage,
                toStage: opportunity.stage,
                durationHours: await this.hoursSinceLastChange(opportunity.id),
                changedBy: actorId ?? null,
                lossReason: opportunity.stage === 'lost' ? opportunity.lossReason ?? null : null,
            }));
            this.emit('deal.stage_changed', opportunity, previousStage, actorId);
            if (opportunity.stage === 'won')
                this.emit('deal.won', opportunity, previousStage, actorId);
            if (opportunity.stage === 'lost')
                this.emit('deal.lost', opportunity, previousStage, actorId);
        }, `cambio de etapa del trato ${opportunity.id}`);
    }
    async hoursSinceLastChange(opportunityId) {
        const last = await this.changes.findOne({
            where: { opportunityId },
            order: { createdAt: 'DESC' },
        });
        if (!last)
            return null;
        const hours = (Date.now() - last.createdAt.getTime()) / 3_600_000;
        return Math.round(hours * 100) / 100;
    }
    emit(name, opportunity, previousStage, actorId) {
        this.events.emit(name, {
            organizationId: opportunity.organizationId,
            opportunityId: opportunity.id,
            leadId: opportunity.leadId,
            clientId: opportunity.clientId,
            stage: opportunity.stage,
            previousStage,
            amount: opportunity.amount,
            assignedTo: opportunity.assignedTo,
            isClosing: CLOSING_STAGES.has(opportunity.stage),
            actorId,
        });
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
exports.OpportunityStageHistoryService = OpportunityStageHistoryService;
exports.OpportunityStageHistoryService = OpportunityStageHistoryService = OpportunityStageHistoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(opportunity_stage_change_entity_1.OpportunityStageChange)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], OpportunityStageHistoryService);
