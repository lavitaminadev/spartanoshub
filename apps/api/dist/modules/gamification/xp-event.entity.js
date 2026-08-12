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
exports.XPEvent = void 0;
const typeorm_1 = require("typeorm");
const piece_entity_1 = require("../production/piece.entity");
let XPEvent = class XPEvent {
};
exports.XPEvent = XPEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], XPEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'xp_period_id', type: 'uuid' }),
    __metadata("design:type", String)
], XPEvent.prototype, "xpPeriodId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], XPEvent.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'piece_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], XPEvent.prototype, "pieceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => piece_entity_1.Piece, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'piece_id' }),
    __metadata("design:type", piece_entity_1.Piece)
], XPEvent.prototype, "piece", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], XPEvent.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int' }),
    __metadata("design:type", Number)
], XPEvent.prototype, "points", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], XPEvent.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], XPEvent.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], XPEvent.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], XPEvent.prototype, "updatedAt", void 0);
exports.XPEvent = XPEvent = __decorate([
    (0, typeorm_1.Entity)('xp_events')
], XPEvent);
