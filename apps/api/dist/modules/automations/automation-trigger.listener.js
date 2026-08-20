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
var AutomationTriggerListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HANDLED_TRIGGER_EVENTS = exports.AutomationTriggerListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const automation_entity_1 = require("./automation.entity");
const automation_run_entity_1 = require("./automation-run.entity");
const automation_catalog_1 = require("./automation-catalog");
let AutomationTriggerListener = AutomationTriggerListener_1 = class AutomationTriggerListener {
    constructor(automations, runs) {
        this.automations = automations;
        this.runs = runs;
        this.logger = new common_1.Logger(AutomationTriggerListener_1.name);
    }
    handleDealCreated(payload) { return this.enqueue('deal.created', payload); }
    handleStageChanged(payload) { return this.enqueue('deal.stage_changed', payload); }
    handleDealWon(payload) { return this.enqueue('deal.won', payload); }
    handleDealLost(payload) { return this.enqueue('deal.lost', payload); }
    handleLeadConverted(payload) { return this.enqueue('lead.converted', payload); }
    handleTaskOverdue(payload) { return this.enqueue('task.overdue', payload); }
    handleDealStale(payload) { return this.enqueue('deal.stale', payload); }
    async enqueue(triggerKey, payload) {
        try {
            const definition = (0, automation_catalog_1.findTrigger)(triggerKey);
            if (!definition || !payload?.organizationId)
                return;
            const entityId = this.entityIdFrom(payload, definition.entityType);
            if (!entityId) {
                this.logger.warn(`Evento ${triggerKey} sin identificador de ${definition.entityType}; no se encola`);
                return;
            }
            const activas = await this.automations.find({
                where: payload.clientId
                    ? [
                        { organizationId: payload.organizationId, triggerType: triggerKey, isActive: true, clientId: (0, typeorm_2.IsNull)() },
                        { organizationId: payload.organizationId, triggerType: triggerKey, isActive: true, clientId: payload.clientId },
                    ]
                    : { organizationId: payload.organizationId, triggerType: triggerKey, isActive: true, clientId: (0, typeorm_2.IsNull)() },
            });
            if (!activas.length)
                return;
            for (const automation of activas) {
                await this.enqueueOne(automation, definition.entityType, entityId, triggerKey, payload);
            }
        }
        catch (error) {
            this.logger.error(`No se pudieron encolar automatizaciones de ${triggerKey}: ${error instanceof Error ? error.message : error}`);
        }
    }
    async enqueueOne(automation, entityType, entityId, triggerKey, payload) {
        const stage = typeof payload.stage === 'string' ? payload.stage : '';
        const occurredOn = typeof payload.occurredOn === 'string' ? payload.occurredOn : '';
        const clave = `${triggerKey}:${entityId}:${stage}${occurredOn ? `:${occurredOn}` : ''}:${automation.version}`;
        const existente = await this.runs.findOne({
            where: { organizationId: automation.organizationId, automationId: automation.id, triggerKey: clave },
            select: { id: true },
        });
        if (existente)
            return;
        await this.runs.save(this.runs.create({
            organizationId: automation.organizationId,
            automationId: automation.id,
            automationVersion: automation.version,
            triggerKey: clave,
            entityType,
            entityId,
            status: 'pending',
            context: { ...payload },
        }));
    }
    entityIdFrom(payload, entityType) {
        const candidatos = {
            opportunity: payload.opportunityId,
            lead: payload.leadId,
            contact: payload.contactId,
            reservation: payload.reservationId,
            service_request: payload.serviceRequestId,
            approval: payload.approvalId,
        };
        const value = candidatos[entityType];
        return typeof value === 'string' ? value : undefined;
    }
};
exports.AutomationTriggerListener = AutomationTriggerListener;
__decorate([
    (0, event_emitter_1.OnEvent)('deal.created'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationTriggerListener.prototype, "handleDealCreated", null);
__decorate([
    (0, event_emitter_1.OnEvent)('deal.stage_changed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationTriggerListener.prototype, "handleStageChanged", null);
__decorate([
    (0, event_emitter_1.OnEvent)('deal.won'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationTriggerListener.prototype, "handleDealWon", null);
__decorate([
    (0, event_emitter_1.OnEvent)('deal.lost'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationTriggerListener.prototype, "handleDealLost", null);
__decorate([
    (0, event_emitter_1.OnEvent)('lead.converted'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationTriggerListener.prototype, "handleLeadConverted", null);
__decorate([
    (0, event_emitter_1.OnEvent)('task.overdue'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationTriggerListener.prototype, "handleTaskOverdue", null);
__decorate([
    (0, event_emitter_1.OnEvent)('deal.stale'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutomationTriggerListener.prototype, "handleDealStale", null);
exports.AutomationTriggerListener = AutomationTriggerListener = AutomationTriggerListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(automation_entity_1.Automation)),
    __param(1, (0, typeorm_1.InjectRepository)(automation_run_entity_1.AutomationRun)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], AutomationTriggerListener);
exports.HANDLED_TRIGGER_EVENTS = automation_catalog_1.AUTOMATION_TRIGGERS.map((trigger) => trigger.event);
