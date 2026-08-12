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
exports.Contract = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
const client_entity_1 = require("../clients/client.entity");
let Contract = class Contract {
};
exports.Contract = Contract;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Contract.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Contract.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Contract.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Contract.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'client_id' }),
    __metadata("design:type", client_entity_1.Client)
], Contract.prototype, "client", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Contract.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'service_type', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Contract.prototype, "serviceType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'start_date', type: 'date' }),
    __metadata("design:type", Date)
], Contract.prototype, "startDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'end_date', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], Contract.prototype, "endDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monthly_ud', type: 'decimal', precision: 8, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Contract.prototype, "monthlyUd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pack_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Contract.prototype, "packId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monthly_price', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Contract.prototype, "monthlyPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'committed_ad_spend', type: 'decimal', precision: 18, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Contract.prototype, "committedAdSpend", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'included_reels', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Contract.prototype, "includedReels", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'billing_cycle', type: 'varchar', length: 30, default: 'monthly_advance' }),
    __metadata("design:type", String)
], Contract.prototype, "billingCycle", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'active' }),
    __metadata("design:type", String)
], Contract.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Contract.prototype, "terms", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Contract.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Contract.prototype, "updatedAt", void 0);
exports.Contract = Contract = __decorate([
    (0, typeorm_1.Entity)('contracts'),
    (0, typeorm_1.Index)('IDX_contracts_org_created', ['organizationId', 'createdAt'])
], Contract);
