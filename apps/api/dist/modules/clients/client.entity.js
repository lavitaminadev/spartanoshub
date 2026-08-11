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
exports.Client = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
const lead_entity_1 = require("../crm/leads/lead.entity");
const client_status_enum_1 = require("./client-status.enum");
const client_capabilities_1 = require("./client-capabilities");
let Client = class Client {
    normalize() {
        this.name = this.name?.trim().replace(/\s+/g, ' ');
        this.legalName = this.legalName?.trim().replace(/\s+/g, ' ') || undefined;
        this.industry = this.industry?.trim().replace(/\s+/g, ' ') || undefined;
        this.currency = this.currency?.trim().toUpperCase() || 'CLP';
        this.capabilities = (0, client_capabilities_1.normalizeClientCapabilities)(this.capabilities);
    }
};
exports.Client = Client;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Client.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Client.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Client.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'lead_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Client.prototype, "leadId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => lead_entity_1.Lead, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'lead_id' }),
    __metadata("design:type", lead_entity_1.Lead)
], Client.prototype, "lead", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'community_manager_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Client.prototype, "communityManagerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pod_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Client.prototype, "podId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Client.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'legal_name', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Client.prototype, "legalName", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Client.prototype, "industry", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: client_status_enum_1.ClientStatus.ONBOARDING }),
    __metadata("design:type", String)
], Client.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'retainer_amount', type: 'decimal', precision: 18, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Client.prototype, "retainerAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'char', length: 3, default: 'CLP' }),
    __metadata("design:type", String)
], Client.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], Client.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'renewal_at', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], Client.prototype, "renewalAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'whatsapp_group', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Client.prototype, "whatsappGroup", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'drive_folder_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Client.prototype, "driveFolderId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'default_ud_budget', type: 'decimal', precision: 8, scale: 2, default: 20 }),
    __metadata("design:type", Number)
], Client.prototype, "defaultUdBudget", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Client.prototype, "capabilities", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'logo_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Client.prototype, "logoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'logo_public_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Client.prototype, "logoPublicId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'daily_reservation_cap', type: 'smallint', default: 0 }),
    __metadata("design:type", Number)
], Client.prototype, "dailyReservationCap", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Client.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Client.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    (0, typeorm_1.BeforeUpdate)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Client.prototype, "normalize", null);
exports.Client = Client = __decorate([
    (0, typeorm_1.Entity)('clients')
], Client);
//# sourceMappingURL=client.entity.js.map