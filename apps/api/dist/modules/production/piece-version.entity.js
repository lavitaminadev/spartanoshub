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
exports.PieceVersion = void 0;
const typeorm_1 = require("typeorm");
const piece_entity_1 = require("./piece.entity");
let PieceVersion = class PieceVersion {
};
exports.PieceVersion = PieceVersion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PieceVersion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'piece_id', type: 'uuid' }),
    __metadata("design:type", String)
], PieceVersion.prototype, "pieceId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => piece_entity_1.Piece, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'piece_id' }),
    __metadata("design:type", piece_entity_1.Piece)
], PieceVersion.prototype, "piece", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'version_number', type: 'int' }),
    __metadata("design:type", Number)
], PieceVersion.prototype, "versionNumber", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'file_name', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], PieceVersion.prototype, "fileName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'drive_file_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], PieceVersion.prototype, "driveFileId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'state_label', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", String)
], PieceVersion.prototype, "stateLabel", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_final', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], PieceVersion.prototype, "isFinal", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'naming_valid', type: 'boolean', nullable: true }),
    __metadata("design:type", Boolean)
], PieceVersion.prototype, "namingValid", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'naming_errors', type: 'json', nullable: true }),
    __metadata("design:type", Array)
], PieceVersion.prototype, "namingErrors", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], PieceVersion.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PieceVersion.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PieceVersion.prototype, "updatedAt", void 0);
exports.PieceVersion = PieceVersion = __decorate([
    (0, typeorm_1.Entity)('piece_versions')
], PieceVersion);
