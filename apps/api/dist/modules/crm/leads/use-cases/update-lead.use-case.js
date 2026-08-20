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
exports.UpdateLeadUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const lead_entity_1 = require("../lead.entity");
const lead_status_enum_1 = require("../lead-status.enum");
const lead_fit_status_enum_1 = require("../lead-fit-status.enum");
const process_history_service_1 = require("../../../../core/process-history/process-history.service");
const process_stage_change_entity_1 = require("../../../../core/process-history/process-stage-change.entity");
const DOMAIN_LABELS = {
    commercial: 'el embudo comercial',
    audience: 'la audiencia de un local',
};
let UpdateLeadUseCase = class UpdateLeadUseCase {
    constructor(repo, history) {
        this.repo = repo;
        this.history = history;
    }
    async execute(id, data, organizationId, actorId) {
        const lead = await this.repo.findOne({ where: { id, organizationId } });
        if (!lead)
            throw new common_1.NotFoundException('Lead not found');
        const etapaPrevia = lead.status;
        if (data.status === lead_status_enum_1.LeadStatus.WON && !lead.convertedToClientId) {
            throw new common_1.BadRequestException('Para marcar un lead como ganado debes convertirlo en cliente');
        }
        if (data.status && Object.values(lead_status_enum_1.LeadStatus).includes(data.status)) {
            if (!(0, lead_status_enum_1.isStatusInDomain)(lead.domain, data.status)) {
                throw new common_1.BadRequestException(`El estado "${data.status}" no corresponde a un lead de ${DOMAIN_LABELS[lead.domain] ?? lead.domain}`);
            }
            lead.status = data.status;
        }
        if (data.fitStatus && Object.values(lead_fit_status_enum_1.LeadFitStatus).includes(data.fitStatus)) {
            lead.fitStatus = data.fitStatus;
        }
        if (data.notes !== undefined)
            lead.notes = data.notes;
        if (data.discardReason !== undefined)
            lead.discardReason = data.discardReason;
        if (data.tags !== undefined)
            lead.tags = data.tags;
        const guardado = await this.repo.save(lead);
        await this.history.recordStageChange(organizationId, process_stage_change_entity_1.ProcessSubject.LEAD, guardado.id, etapaPrevia, guardado.status, actorId, guardado.discardReason);
        return guardado;
    }
};
exports.UpdateLeadUseCase = UpdateLeadUseCase;
exports.UpdateLeadUseCase = UpdateLeadUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(lead_entity_1.Lead)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        process_history_service_1.ProcessHistoryService])
], UpdateLeadUseCase);
