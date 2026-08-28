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
exports.ConvertLeadUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("../lead.entity");
const lead_status_enum_1 = require("../lead-status.enum");
const client_entity_1 = require("../../../clients/client.entity");
const event_emitter_1 = require("@nestjs/event-emitter");
const client_status_enum_1 = require("../../../clients/client-status.enum");
let ConvertLeadUseCase = class ConvertLeadUseCase {
    constructor(leadRepo, clientRepo, eventEmitter) {
        this.leadRepo = leadRepo;
        this.clientRepo = clientRepo;
        this.eventEmitter = eventEmitter;
    }
    async execute(leadId, organizationId) {
        let etapaPrevia = '';
        const result = await this.leadRepo.manager.transaction(async (manager) => {
            const lead = await manager.findOne(lead_entity_1.Lead, {
                where: { id: leadId, organizationId },
                lock: { mode: 'pessimistic_write' },
            });
            if (!lead)
                throw new common_1.NotFoundException('Lead no encontrado');
            if (lead.convertedToClientId) {
                throw new common_1.ConflictException('El lead ya fue convertido');
            }
            if (lead.domain === 'audience') {
                throw new common_1.BadRequestException('Un contacto de campaña no se convierte en empresa cliente: es una persona que respondió '
                    + 'a la campaña de un local, no alguien a quien la agencia le presta servicios.');
            }
            const client = manager.create(client_entity_1.Client, {
                organizationId,
                name: lead.name,
                leadId: lead.id,
                status: client_status_enum_1.ClientStatus.ONBOARDING,
            });
            const savedClient = await manager.save(client_entity_1.Client, client);
            etapaPrevia = lead.status;
            lead.status = lead_status_enum_1.LeadStatus.WON;
            lead.convertedAt = new Date();
            lead.convertedToClientId = savedClient.id;
            await manager.save(lead_entity_1.Lead, lead);
            return { lead, client: savedClient };
        });
        this.eventEmitter.emit('lead.converted', {
            organizationId,
            leadId: result.lead.id,
            clientId: result.client.id,
        });
        if (etapaPrevia !== lead_status_enum_1.LeadStatus.WON) {
            this.eventEmitter.emit('lead.won', {
                organizationId,
                leadId: result.lead.id,
                clientId: result.lead.clientId ?? null,
            });
        }
        return result;
    }
};
exports.ConvertLeadUseCase = ConvertLeadUseCase;
exports.ConvertLeadUseCase = ConvertLeadUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        event_emitter_1.EventEmitter2])
], ConvertLeadUseCase);
