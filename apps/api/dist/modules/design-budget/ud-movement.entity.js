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
exports.UDMovement = void 0;
const typeorm_1 = require("typeorm");
const ud_budget_entity_1 = require("./ud-budget.entity");
const piece_entity_1 = require("../production/piece.entity");
let UDMovement = class UDMovement {
};
exports.UDMovement = UDMovement;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UDMovement.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ud_budget_id', type: 'uuid' }),
    __metadata("design:type", String)
], UDMovement.prototype, "udBudgetId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => ud_budget_entity_1.UDBudget, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'ud_budget_id' }),
    __metadata("design:type", ud_budget_entity_1.UDBudget)
], UDMovement.prototype, "udBudget", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'piece_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], UDMovement.prototype, "pieceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => piece_entity_1.Piece, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'piece_id' }),
    __metadata("design:type", piece_entity_1.Piece)
], UDMovement.prototype, "piece", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], UDMovement.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 8, scale: 2 }),
    __metadata("design:type", Number)
], UDMovement.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], UDMovement.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actor_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], UDMovement.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UDMovement.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UDMovement.prototype, "updatedAt", void 0);
exports.UDMovement = UDMovement = __decorate([
    (0, typeorm_1.Entity)('ud_movements')
], UDMovement);
