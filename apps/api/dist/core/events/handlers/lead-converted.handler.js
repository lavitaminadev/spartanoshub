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
var LeadConvertedHandler_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadConvertedHandler = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("../../../modules/crm/leads/lead.entity");
const client_entity_1 = require("../../../modules/clients/client.entity");
const onboarding_entity_1 = require("../../../modules/onboarding/onboarding.entity");
const notification_entity_1 = require("../../notifications/notification.entity");
const workflows_service_1 = require("../../../modules/workflows/workflows.service");
let LeadConvertedHandler = LeadConvertedHandler_1 = class LeadConvertedHandler {
    constructor(leadRepo, clientRepo, onboardingRepo, notifRepo, workflows) {
        this.leadRepo = leadRepo;
        this.clientRepo = clientRepo;
        this.onboardingRepo = onboardingRepo;
        this.notifRepo = notifRepo;
        this.workflows = workflows;
        this.logger = new common_1.Logger(LeadConvertedHandler_1.name);
    }
    async handle(payload) {
        try {
            const lead = await this.leadRepo.findOne({ where: { id: payload.leadId, organizationId: payload.organizationId } });
            if (!lead)
                return;
            const client = await this.clientRepo.findOne({ where: { id: payload.clientId, organizationId: payload.organizationId } });
            if (!client)
                return;
            if (lead.assignedTo) {
                const notif = this.notifRepo.create({
                    organizationId: lead.organizationId,
                    userId: lead.assignedTo,
                    type: 'lead.converted',
                    title: 'Lead convertido',
                    message: `El lead ${lead.name} se ha convertido en cliente.`,
                    data: { leadId: payload.leadId, clientId: payload.clientId },
                });
                await this.notifRepo.save(notif);
            }
            const steps = await this.workflows.getSteps(client.organizationId, 'onboarding');
            if (steps.length) {
                await this.onboardingRepo.save(steps.map((step, index) => this.onboardingRepo.create({
                    clientId: payload.clientId,
                    organizationId: client.organizationId,
                    step: step.label,
                    status: 'pending',
                    assignedTo: index === 0 ? lead.assignedTo : undefined,
                    notes: step.slaHours ? `SLA sugerido: ${step.slaHours} horas${step.responsibleRole ? ` · Responsable: ${step.responsibleRole}` : ''}` : undefined,
                })));
            }
        }
        catch (error) {
            this.logger.error(`Error procesando lead.converted para lead ${payload.leadId}: ${error instanceof Error ? error.message : error}`);
        }
    }
};
exports.LeadConvertedHandler = LeadConvertedHandler;
__decorate([
    (0, event_emitter_1.OnEvent)('lead.converted'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LeadConvertedHandler.prototype, "handle", null);
exports.LeadConvertedHandler = LeadConvertedHandler = LeadConvertedHandler_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(2, (0, typeorm_1.InjectRepository)(onboarding_entity_1.Onboarding)),
    __param(3, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        workflows_service_1.WorkflowsService])
], LeadConvertedHandler);
//# sourceMappingURL=lead-converted.handler.js.map