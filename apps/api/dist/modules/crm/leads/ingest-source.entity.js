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
exports.LeadIngestSource = void 0;
const typeorm_1 = require("typeorm");
let LeadIngestSource = class LeadIngestSource {
};
exports.LeadIngestSource = LeadIngestSource;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], LeadIngestSource.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], LeadIngestSource.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], LeadIngestSource.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], LeadIngestSource.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 60 }),
    __metadata("design:type", String)
], LeadIngestSource.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'campaign_name', type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", Object)
], LeadIngestSource.prototype, "campaignName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'campaign_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], LeadIngestSource.prototype, "campaignId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_hash', type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], LeadIngestSource.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_hint', type: 'varchar', length: 12 }),
    __metadata("design:type", String)
], LeadIngestSource.prototype, "tokenHint", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'previous_token_hash', type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], LeadIngestSource.prototype, "previousTokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'previous_token_expires_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], LeadIngestSource.prototype, "previousTokenExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], LeadIngestSource.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'received_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], LeadIngestSource.prototype, "receivedCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_received_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], LeadIngestSource.prototype, "lastReceivedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'varchar', length: 300, nullable: true }),
    __metadata("design:type", Object)
], LeadIngestSource.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], LeadIngestSource.prototype, "lastErrorAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], LeadIngestSource.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], LeadIngestSource.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], LeadIngestSource.prototype, "updatedAt", void 0);
exports.LeadIngestSource = LeadIngestSource = __decorate([
    (0, typeorm_1.Entity)('lead_ingest_sources'),
    (0, typeorm_1.Index)('UQ_lead_ingest_sources_token', ['tokenHash'], { unique: true }),
    (0, typeorm_1.Index)('IDX_lead_ingest_sources_org', ['organizationId', 'isActive'])
], LeadIngestSource);
