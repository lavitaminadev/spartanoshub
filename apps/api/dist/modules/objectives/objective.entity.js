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
exports.Objective = void 0;
const typeorm_1 = require("typeorm");
let Objective = class Objective {
};
exports.Objective = Objective;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Objective.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Objective.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'owner_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Objective.prototype, "ownerId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Objective.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], Objective.prototype, "category", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Objective.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Objective.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'active' }),
    __metadata("design:type", String)
], Objective.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint', default: 0 }),
    __metadata("design:type", Number)
], Objective.prototype, "progress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'due_at', type: 'date', nullable: true }),
    __metadata("design:type", Date)
], Objective.prototype, "dueAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid' }),
    __metadata("design:type", String)
], Objective.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Objective.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Objective.prototype, "updatedAt", void 0);
exports.Objective = Objective = __decorate([
    (0, typeorm_1.Entity)('objectives'),
    (0, typeorm_1.Index)('IDX_objectives_org_status', ['organizationId', 'status'])
], Objective);
