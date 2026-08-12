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
exports.UpdateOpportunityUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const opportunity_entity_1 = require("../opportunity.entity");
const opportunity_reference_validator_service_1 = require("../opportunity-reference-validator.service");
const get_opportunity_use_case_1 = require("./get-opportunity.use-case");
let UpdateOpportunityUseCase = class UpdateOpportunityUseCase {
    constructor(repo, referenceValidator, getOpportunity) {
        this.repo = repo;
        this.referenceValidator = referenceValidator;
        this.getOpportunity = getOpportunity;
    }
    async execute(id, dto, organizationId) {
        const opportunity = await this.getOpportunity.execute(id, organizationId);
        await this.referenceValidator.validate(dto, organizationId);
        const movingToLost = dto.stage?.trim().toLowerCase() === 'lost' && opportunity.stage !== 'lost';
        if (movingToLost && !dto.lossReason && !opportunity.lossReason) {
            throw new common_1.BadRequestException('Indica el motivo de pérdida antes de cerrar la oportunidad como perdida');
        }
        Object.assign(opportunity, dto);
        if (dto.name !== undefined)
            opportunity.name = dto.name.trim().replace(/\s+/g, ' ');
        if (dto.stage !== undefined)
            opportunity.stage = dto.stage.trim().toLowerCase();
        if (dto.lossReason !== undefined)
            opportunity.lossReason = dto.lossReason.trim();
        if (dto.lossNote !== undefined)
            opportunity.lossNote = dto.lossNote?.trim() || undefined;
        if (dto.expectedCloseDate !== undefined)
            opportunity.expectedCloseDate = dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined;
        if (dto.nextAction !== undefined)
            opportunity.nextAction = dto.nextAction?.trim().replace(/\s+/g, ' ') || undefined;
        if (dto.nextActionAt !== undefined)
            opportunity.nextActionAt = dto.nextActionAt ? new Date(dto.nextActionAt) : undefined;
        return this.repo.save(opportunity);
    }
};
exports.UpdateOpportunityUseCase = UpdateOpportunityUseCase;
exports.UpdateOpportunityUseCase = UpdateOpportunityUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(opportunity_entity_1.Opportunity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        opportunity_reference_validator_service_1.OpportunityReferenceValidator,
        get_opportunity_use_case_1.GetOpportunityUseCase])
], UpdateOpportunityUseCase);
