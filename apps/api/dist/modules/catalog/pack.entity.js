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
exports.Pack = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
let Pack = class Pack {
};
exports.Pack = Pack;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Pack.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Pack.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Pack.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Pack.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Pack.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monthly_ud', type: 'decimal', precision: 8, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Pack.prototype, "monthlyUd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reels_included', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Pack.prototype, "reelsIncluded", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'monthly_price', type: 'decimal', precision: 18, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], Pack.prototype, "monthlyPrice", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'char', length: 3, default: 'CLP' }),
    __metadata("design:type", String)
], Pack.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Pack.prototype, "services", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'active' }),
    __metadata("design:type", String)
], Pack.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Pack.prototype, "createdAt", void 0);
exports.Pack = Pack = __decorate([
    (0, typeorm_1.Entity)('catalog_packs')
], Pack);
//# sourceMappingURL=pack.entity.js.map