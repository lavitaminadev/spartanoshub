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
exports.Correction = void 0;
const typeorm_1 = require("typeorm");
const piece_entity_1 = require("./piece.entity");
const piece_version_entity_1 = require("./piece-version.entity");
const correction_origin_enum_1 = require("./correction-origin.enum");
let Correction = class Correction {
};
exports.Correction = Correction;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Correction.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'piece_id', type: 'uuid' }),
    __metadata("design:type", String)
], Correction.prototype, "pieceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => piece_entity_1.Piece, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'piece_id' }),
    __metadata("design:type", piece_entity_1.Piece)
], Correction.prototype, "piece", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'piece_version_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Correction.prototype, "pieceVersionId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => piece_version_entity_1.PieceVersion, { nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'piece_version_id' }),
    __metadata("design:type", piece_version_entity_1.PieceVersion)
], Correction.prototype, "pieceVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], Correction.prototype, "origin", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Correction.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requested_by', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Correction.prototype, "requestedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'billable_extra', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Correction.prototype, "billableExtra", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'charge_note_required', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], Correction.prototype, "chargeNoteRequired", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_by', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Correction.prototype, "resolvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Correction.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Correction.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Correction.prototype, "updatedAt", void 0);
exports.Correction = Correction = __decorate([
    (0, typeorm_1.Entity)('corrections')
], Correction);
