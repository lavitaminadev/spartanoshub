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
var AutomationScheduleJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationScheduleJob = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const opportunity_entity_1 = require("../crm/opportunities/opportunity.entity");
const approval_request_entity_1 = require("../approvals/approval-request.entity");
const approval_request_status_enum_1 = require("../approvals/approval-request-status.enum");
const BATCH_LIMIT = 50;
let AutomationScheduleJob = AutomationScheduleJob_1 = class AutomationScheduleJob {
    constructor(opportunities, approvals, events) {
        this.opportunities = opportunities;
        this.approvals = approvals;
        this.events = events;
        this.logger = new common_1.Logger(AutomationScheduleJob_1.name);
    }
    async handle() {
        const [overdueTasks, staleDeals] = await Promise.all([
            this.announceOverdueTasks(),
            this.announceStaleDeals(),
        ]);
        if (overdueTasks || staleDeals) {
            this.logger.log(`Disparadores de tiempo: ${overdueTasks} tareas vencidas, ${staleDeals} tratos sin seguimiento`);
        }
        return { overdueTasks, staleDeals };
    }
    async announceOverdueTasks() {
        const pendientes = await this.approvals.find({
            where: {
                status: (0, typeorm_2.In)([...approval_request_status_enum_1.OPEN_STATUSES]),
                dueAt: (0, typeorm_2.LessThan)(new Date()),
            },
            order: { dueAt: 'ASC' },
            take: BATCH_LIMIT,
        });
        for (const approval of pendientes) {
            this.events.emit('task.overdue', {
                organizationId: approval.organizationId,
                approvalId: approval.id,
                entityType: approval.entityType,
                entityId: approval.entityId,
                kind: approval.kind,
                title: approval.title,
                assignedTo: approval.assignedTo,
                clientId: approval.clientId,
                dueAt: approval.dueAt?.toISOString(),
                occurredOn: this.today(),
            });
        }
        return pendientes.length;
    }
    async announceStaleDeals() {
        const atrasados = await this.opportunities.find({
            where: {
                nextActionAt: (0, typeorm_2.LessThan)(new Date()),
                stage: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()),
            },
            order: { nextActionAt: 'ASC' },
            take: BATCH_LIMIT * 2,
        });
        const abiertos = atrasados
            .filter((deal) => deal.stage !== 'won' && deal.stage !== 'lost')
            .slice(0, BATCH_LIMIT);
        for (const deal of abiertos) {
            this.events.emit('deal.stale', {
                organizationId: deal.organizationId,
                opportunityId: deal.id,
                leadId: deal.leadId,
                clientId: deal.clientId,
                stage: deal.stage,
                amount: deal.amount,
                assignedTo: deal.assignedTo,
                nextAction: deal.nextAction,
                nextActionAt: deal.nextActionAt?.toISOString(),
                occurredOn: this.today(),
            });
        }
        return abiertos.length;
    }
    today() {
        return new Date().toISOString().slice(0, 10);
    }
};
exports.AutomationScheduleJob = AutomationScheduleJob;
exports.AutomationScheduleJob = AutomationScheduleJob = AutomationScheduleJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(opportunity_entity_1.Opportunity)),
    __param(1, (0, typeorm_1.InjectRepository)(approval_request_entity_1.ApprovalRequest)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], AutomationScheduleJob);
