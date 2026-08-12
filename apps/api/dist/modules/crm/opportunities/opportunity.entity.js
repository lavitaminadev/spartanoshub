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
exports.Opportunity = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../../organizations/organization.entity");
let Opportunity = class Opportunity {
};
exports.Opportunity = Opportunity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Opportunity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Opportunity.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Opportunity.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'lead_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Opportunity.prototype, "leadId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Opportunity.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Opportunity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Opportunity.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'new' }),
    __metadata("design:type", String)
], Opportunity.prototype, "stage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Opportunity.prototype, "probability", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expected_close_date', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], Opportunity.prototype, "expectedCloseDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_action', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Opportunity.prototype, "nextAction", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_action_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Opportunity.prototype, "nextActionAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'loss_reason', type: 'varchar', length: 60, nullable: true }),
    __metadata("design:type", String)
], Opportunity.prototype, "lossReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'loss_note', type: 'text', nullable: true }),
    __metadata("design:type", String)
], Opportunity.prototype, "lossNote", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'assigned_to', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Opportunity.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Opportunity.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Opportunity.prototype, "updatedAt", void 0);
exports.Opportunity = Opportunity = __decorate([
    (0, typeorm_1.Entity)('crm_opportunities'),
    (0, typeorm_1.Index)('IDX_crm_opportunities_org_created', ['organizationId', 'createdAt'])
], Opportunity);
