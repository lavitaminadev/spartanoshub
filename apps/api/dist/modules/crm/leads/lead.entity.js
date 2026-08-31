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
exports.Lead = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../../organizations/organization.entity");
const phone_1 = require("../../../shared/phone");
let Lead = class Lead {
    normalize() {
        this.name = this.name?.trim();
        this.email = this.email?.trim().toLowerCase() || null;
        this.phone = (0, phone_1.normalizePhone)(this.phone) ?? null;
        this.company = this.company?.trim() || null;
        this.source = this.source?.trim() || undefined;
        this.sourceDetail = this.sourceDetail?.trim() || null;
        this.campaignName = this.campaignName?.trim() || null;
        this.notes = this.notes?.trim() || undefined;
    }
};
exports.Lead = Lead;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Lead.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Lead.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Lead.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Lead.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "company", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Lead.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'commercial' }),
    __metadata("design:type", String)
], Lead.prototype, "domain", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_detail', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "sourceDetail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], Lead.prototype, "tags", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_lead_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Lead.prototype, "externalLeadId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_form_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Lead.prototype, "externalFormId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_form_name', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "externalFormName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'external_campaign_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Lead.prototype, "externalCampaignId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'campaign_name', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "campaignName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'page_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Lead.prototype, "pageId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'new' }),
    __metadata("design:type", String)
], Lead.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fit_status', type: 'varchar', length: 50, default: 'review' }),
    __metadata("design:type", String)
], Lead.prototype, "fitStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quality_score', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Lead.prototype, "qualityScore", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'traffic_light', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "trafficLight", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'discard_reason', type: 'text', nullable: true }),
    __metadata("design:type", String)
], Lead.prototype, "discardReason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'assigned_to', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Lead.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'consent_captured_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Lead.prototype, "consentCapturedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'birth_date', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "birthDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'excluded_from_meta', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Lead.prototype, "excludedFromMeta", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'retention_review_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Lead.prototype, "retentionReviewAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'converted_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Lead.prototype, "convertedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'converted_to_client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Lead.prototype, "convertedToClientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'estimated_amount', type: 'decimal', precision: 14, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "estimatedAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_created_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "sourceCreatedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'stage_changed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "stageChangedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'idle_alerted_level', type: 'varchar', length: 10, nullable: true }),
    __metadata("design:type", Object)
], Lead.prototype, "idleAlertedLevel", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Lead.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Lead.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    (0, typeorm_1.BeforeUpdate)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Lead.prototype, "normalize", null);
exports.Lead = Lead = __decorate([
    (0, typeorm_1.Entity)('leads'),
    (0, typeorm_1.Index)('UQ_leads_org_external', ['organizationId', 'externalLeadId'], { unique: true }),
    (0, typeorm_1.Index)('IDX_leads_org_status_updated', ['organizationId', 'status', 'updatedAt']),
    (0, typeorm_1.Index)('IDX_leads_org_assigned', ['organizationId', 'assignedTo']),
    (0, typeorm_1.Index)('IDX_leads_org_source_created', ['organizationId', 'sourceCreatedAt'])
], Lead);
