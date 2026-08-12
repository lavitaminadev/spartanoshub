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
exports.Organization = void 0;
const typeorm_1 = require("typeorm");
const organization_features_1 = require("./organization-features");
let Organization = class Organization {
    normalizeFeatures() {
        this.features = (0, organization_features_1.normalizeOrganizationFeatures)(this.features);
    }
};
exports.Organization = Organization;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Organization.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Organization.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, unique: true }),
    __metadata("design:type", String)
], Organization.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'logo_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "logoUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'welcome_message', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Organization.prototype, "welcomeMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 3, default: 'CLP' }),
    __metadata("design:type", String)
], Organization.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], Organization.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], Organization.prototype, "features", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Organization.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Organization.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.AfterLoad)(),
    (0, typeorm_1.BeforeInsert)(),
    (0, typeorm_1.BeforeUpdate)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Organization.prototype, "normalizeFeatures", null);
exports.Organization = Organization = __decorate([
    (0, typeorm_1.Entity)('organizations')
], Organization);
