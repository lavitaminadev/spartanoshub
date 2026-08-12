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
exports.Moodboard = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
const client_entity_1 = require("../clients/client.entity");
let Moodboard = class Moodboard {
};
exports.Moodboard = Moodboard;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Moodboard.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Moodboard.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Moodboard.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], Moodboard.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client),
    (0, typeorm_1.JoinColumn)({ name: 'client_id' }),
    __metadata("design:type", client_entity_1.Client)
], Moodboard.prototype, "client", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Moodboard.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Moodboard.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Array)
], Moodboard.prototype, "images", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Moodboard.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'verified_by', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Moodboard.prototype, "verifiedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'draft' }),
    __metadata("design:type", String)
], Moodboard.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Moodboard.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Moodboard.prototype, "updatedAt", void 0);
exports.Moodboard = Moodboard = __decorate([
    (0, typeorm_1.Entity)('moodboards'),
    (0, typeorm_1.Index)('IDX_moodboards_org_created', ['organizationId', 'createdAt'])
], Moodboard);
