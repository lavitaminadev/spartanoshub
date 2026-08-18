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
exports.CreateOpportunityUseCase = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const opportunity_entity_1 = require("../opportunity.entity");
const opportunity_reference_validator_service_1 = require("../opportunity-reference-validator.service");
const opportunity_stage_history_service_1 = require("../opportunity-stage-history.service");
let CreateOpportunityUseCase = class CreateOpportunityUseCase {
    constructor(repo, referenceValidator, stageHistory) {
        this.repo = repo;
        this.referenceValidator = referenceValidator;
        this.stageHistory = stageHistory;
    }
    async execute(dto, organizationId, actorId) {
        await this.referenceValidator.validate(dto, organizationId);
        const opportunity = this.repo.create({
            ...dto,
            organizationId,
            name: dto.name.trim().replace(/\s+/g, ' '),
            stage: dto.stage?.trim().toLowerCase() || 'new',
            expectedCloseDate: dto.expectedCloseDate ? new Date(dto.expectedCloseDate) : undefined,
            nextAction: dto.nextAction?.trim().replace(/\s+/g, ' ') || undefined,
            nextActionAt: dto.nextActionAt ? new Date(dto.nextActionAt) : undefined,
        });
        const saved = await this.repo.save(opportunity);
        await this.stageHistory.recordCreated(saved, actorId);
        return saved;
    }
};
exports.CreateOpportunityUseCase = CreateOpportunityUseCase;
exports.CreateOpportunityUseCase = CreateOpportunityUseCase = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(opportunity_entity_1.Opportunity)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        opportunity_reference_validator_service_1.OpportunityReferenceValidator,
        opportunity_stage_history_service_1.OpportunityStageHistoryService])
], CreateOpportunityUseCase);
