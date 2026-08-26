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
exports.Campaign = void 0;
const typeorm_1 = require("typeorm");
let Campaign = class Campaign {
};
exports.Campaign = Campaign;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Campaign.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Campaign.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Campaign.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 180 }),
    __metadata("design:type", String)
], Campaign.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: 'Meta Ads' }),
    __metadata("design:type", String)
], Campaign.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'starts_at', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Campaign.prototype, "startsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ends_at', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Campaign.prototype, "endsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 14, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Campaign.prototype, "investment", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'active' }),
    __metadata("design:type", String)
], Campaign.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'meta_pixel_id', type: 'varchar', length: 40, nullable: true }),
    __metadata("design:type", Object)
], Campaign.prototype, "metaPixelId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Campaign.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Campaign.prototype, "updatedAt", void 0);
exports.Campaign = Campaign = __decorate([
    (0, typeorm_1.Entity)('crm_campaigns'),
    (0, typeorm_1.Index)('IDX_crm_campaigns_org_name', ['organizationId', 'name'])
], Campaign);
