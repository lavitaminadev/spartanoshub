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
var LeadCreatedEmailListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadCreatedEmailListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const email_service_1 = require("../../../core/notifications/email.service");
const plantilla_de_correo_1 = require("../../../core/notifications/plantilla-de-correo");
const parameter_resolver_service_1 = require("../../../core/parameters/parameter-resolver.service");
const user_entity_1 = require("../../users/user.entity");
const lead_entity_1 = require("./lead.entity");
let LeadCreatedEmailListener = LeadCreatedEmailListener_1 = class LeadCreatedEmailListener {
    constructor(leads, users, parameters, email) {
        this.leads = leads;
        this.users = users;
        this.parameters = parameters;
        this.email = email;
        this.logger = new common_1.Logger(LeadCreatedEmailListener_1.name);
    }
    async handle(event) {
        if (!event.clientId)
            return;
        try {
            const enabled = await this.parameters.get('email.new_lead_enabled', event.clientId, null, event.organizationId);
            if (enabled !== true)
                return;
            const [lead, subjectTemplate, bodyTemplate, recipients] = await Promise.all([
                this.leads.findOne({
                    where: { id: event.leadId, organizationId: event.organizationId, clientId: event.clientId },
                    select: {
                        id: true, name: true, email: true, phone: true, source: true,
                        campaignName: true, organizationId: true, clientId: true,
                    },
                }),
                this.parameters.get('email.new_lead_subject', event.clientId, null, event.organizationId),
                this.parameters.get('email.new_lead_body', event.clientId, null, event.organizationId),
                this.users.find({
                    where: { organizationId: event.organizationId, clientId: event.clientId, isActive: true },
                    select: { id: true, name: true, email: true },
                    order: { createdAt: 'ASC' },
                }),
            ]);
            if (!lead || typeof subjectTemplate !== 'string' || typeof bodyTemplate !== 'string')
                return;
            const sentTo = new Set();
            for (const recipient of recipients) {
                const address = recipient.email?.trim().toLowerCase();
                if (!address || sentTo.has(address))
                    continue;
                sentTo.add(address);
                const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(subjectTemplate, bodyTemplate, {
                    responsable: recipient.name,
                    lead: lead.name,
                    origen: lead.source?.replace(/_/g, ' ') || 'Sin origen informado',
                    campana: lead.campaignName || 'Sin campaña',
                    telefono: lead.phone || 'Sin teléfono',
                    correo: lead.email || 'Sin correo',
                });
                const delivered = await this.email.send(address, subject, html);
                if (!delivered) {
                    this.logger.warn(`No se entregó el aviso del lead ${lead.id} a ${address}`);
                }
            }
        }
        catch (error) {
            this.logger.error(`No se pudo preparar el aviso del lead ${event.leadId}: ${error instanceof Error ? error.message : error}`);
        }
    }
};
exports.LeadCreatedEmailListener = LeadCreatedEmailListener;
__decorate([
    (0, event_emitter_1.OnEvent)('lead.created'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LeadCreatedEmailListener.prototype, "handle", null);
exports.LeadCreatedEmailListener = LeadCreatedEmailListener = LeadCreatedEmailListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        parameter_resolver_service_1.ParameterResolver,
        email_service_1.EmailService])
], LeadCreatedEmailListener);
