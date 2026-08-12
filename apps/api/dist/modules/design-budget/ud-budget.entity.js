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
exports.UDBudget = void 0;
const typeorm_1 = require("typeorm");
const client_entity_1 = require("../clients/client.entity");
let UDBudget = class UDBudget {
};
exports.UDBudget = UDBudget;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UDBudget.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], UDBudget.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'client_id' }),
    __metadata("design:type", client_entity_1.Client)
], UDBudget.prototype, "client", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint' }),
    __metadata("design:type", Number)
], UDBudget.prototype, "year", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'tinyint' }),
    __metadata("design:type", Number)
], UDBudget.prototype, "month", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 8, scale: 2 }),
    __metadata("design:type", Number)
], UDBudget.prototype, "contracted", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 8, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], UDBudget.prototype, "reserved", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 8, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], UDBudget.prototype, "consumed", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'open' }),
    __metadata("design:type", String)
], UDBudget.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UDBudget.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UDBudget.prototype, "updatedAt", void 0);
exports.UDBudget = UDBudget = __decorate([
    (0, typeorm_1.Entity)('ud_budgets')
], UDBudget);
