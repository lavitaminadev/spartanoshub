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
exports.Piece = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
const client_entity_1 = require("../clients/client.entity");
const piece_status_enum_1 = require("./piece-status.enum");
const piece_type_enum_1 = require("./piece-type.enum");
let Piece = class Piece {
};
exports.Piece = Piece;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Piece.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Piece.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], Piece.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], Piece.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => client_entity_1.Client),
    (0, typeorm_1.JoinColumn)({ name: 'client_id' }),
    __metadata("design:type", client_entity_1.Client)
], Piece.prototype, "client", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'assigned_to', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], Piece.prototype, "assignedTo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'assigned_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Piece.prototype, "assignedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Piece.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], Piece.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], Piece.prototype, "title", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: piece_status_enum_1.PieceStatus.BACKLOG }),
    __metadata("design:type", String)
], Piece.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'difficulty_level', type: 'tinyint', default: 1 }),
    __metadata("design:type", Number)
], Piece.prototype, "difficultyLevel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ud_amount', type: 'decimal', precision: 8, scale: 2, default: 0 }),
    __metadata("design:type", Number)
], Piece.prototype, "udAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'deadline_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Piece.prototype, "deadlineAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'dependency_ids', type: 'json', nullable: true }),
    __metadata("design:type", Array)
], Piece.prototype, "dependencyIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'delivered_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Piece.prototype, "deliveredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'correction_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Piece.prototype, "correctionCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_correction_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Piece.prototype, "clientCorrectionCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'drive_link', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Piece.prototype, "driveLink", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'stale_alerted_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], Piece.prototype, "staleAlertedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Piece.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Piece.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Piece.prototype, "updatedAt", void 0);
exports.Piece = Piece = __decorate([
    (0, typeorm_1.Entity)('pieces')
], Piece);
