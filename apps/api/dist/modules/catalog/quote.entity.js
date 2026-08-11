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
exports.Quote = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
const client_entity_1 = require("../clients/client.entity");
const quote_status_enum_1 = require("./quote-status.enum");
const lead_entity_1 = require("../crm/leads/lead.entity");
let Quote = class Quote {
};
exports.Quote = Quote;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Quote.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Quote.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Quote.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Quote.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'client_id' }),
    __metadata("design:type", client_entity_1.Client)
], Quote.prototype, "client", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'lead_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Quote.prototype, "leadId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => lead_entity_1.Lead, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'lead_id' }),
    __metadata("design:type", lead_entity_1.Lead)
], Quote.prototype, "lead", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 1 }),
    __metadata("design:type", Number)
], Quote.prototype, "version", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'parent_quote_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Quote.prototype, "parentQuoteId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sent_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Quote.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], Quote.prototype, "number", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Quote.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 2 }),
    __metadata("design:type", Number)
], Quote.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'char', length: 3, default: 'CLP' }),
    __metadata("design:type", String)
], Quote.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: quote_status_enum_1.QuoteStatus.DRAFT }),
    __metadata("design:type", String)
], Quote.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'valid_until', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], Quote.prototype, "validUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'accepted_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Quote.prototype, "acceptedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid' }),
    __metadata("design:type", String)
], Quote.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], Quote.prototype, "items", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Quote.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Quote.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Quote.prototype, "updatedAt", void 0);
exports.Quote = Quote = __decorate([
    (0, typeorm_1.Entity)('quotes'),
    (0, typeorm_1.Index)('UQ_quotes_org_number', ['organizationId', 'number'], { unique: true }),
    (0, typeorm_1.Index)('IDX_quotes_org_created', ['organizationId', 'createdAt'])
], Quote);
//# sourceMappingURL=quote.entity.js.map