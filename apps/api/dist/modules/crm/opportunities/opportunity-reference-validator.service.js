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
exports.OpportunityReferenceValidator = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("../leads/lead.entity");
const client_entity_1 = require("../../clients/client.entity");
const user_entity_1 = require("../../users/user.entity");
let OpportunityReferenceValidator = class OpportunityReferenceValidator {
    constructor(leads, clients, users) {
        this.leads = leads;
        this.clients = clients;
        this.users = users;
    }
    async validate(dto, organizationId) {
        const checks = [];
        if (dto.leadId)
            checks.push(this.leads.findOne({ where: { id: dto.leadId, organizationId }, select: { id: true } })
                .then((lead) => { if (!lead)
                throw new common_1.BadRequestException('El lead no pertenece a esta organización'); }));
        if (dto.clientId)
            checks.push(this.clients.findOne({ where: { id: dto.clientId, organizationId }, select: { id: true } })
                .then((client) => { if (!client)
                throw new common_1.BadRequestException('El cliente no pertenece a esta organización'); }));
        if (dto.assignedTo)
            checks.push(this.users.findOne({ where: { id: dto.assignedTo, organizationId, isActive: true }, select: { id: true } })
                .then((user) => { if (!user)
                throw new common_1.BadRequestException('El responsable no pertenece a esta organización o está inactivo'); }));
        await Promise.all(checks);
    }
};
exports.OpportunityReferenceValidator = OpportunityReferenceValidator;
exports.OpportunityReferenceValidator = OpportunityReferenceValidator = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __param(1, (0, typeorm_1.InjectRepository)(client_entity_1.Client)),
    __param(2, (0, typeorm_1.InjectRepository)(user_entity_1.User)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], OpportunityReferenceValidator);
