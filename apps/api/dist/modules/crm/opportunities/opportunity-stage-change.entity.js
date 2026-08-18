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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpportunityStageChange = void 0;
const typeorm_1 = require("typeorm");
let OpportunityStageChange = class OpportunityStageChange {
};
exports.OpportunityStageChange = OpportunityStageChange;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], OpportunityStageChange.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], OpportunityStageChange.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'opportunity_id', type: 'uuid' }),
    __metadata("design:type", String)
], OpportunityStageChange.prototype, "opportunityId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'from_stage', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], OpportunityStageChange.prototype, "fromStage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'to_stage', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], OpportunityStageChange.prototype, "toStage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'duration_hours', type: 'decimal', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], OpportunityStageChange.prototype, "durationHours", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'changed_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], OpportunityStageChange.prototype, "changedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'loss_reason', type: 'varchar', length: 60, nullable: true }),
    __metadata("design:type", Object)
], OpportunityStageChange.prototype, "lossReason", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], OpportunityStageChange.prototype, "createdAt", void 0);
exports.OpportunityStageChange = OpportunityStageChange = __decorate([
    (0, typeorm_1.Entity)('crm_opportunity_stage_changes'),
    (0, typeorm_1.Index)('IDX_opportunity_stage_changes_opportunity', ['opportunityId', 'createdAt']),
    (0, typeorm_1.Index)('IDX_opportunity_stage_changes_org_stage', ['organizationId', 'toStage', 'createdAt'])
], OpportunityStageChange);
