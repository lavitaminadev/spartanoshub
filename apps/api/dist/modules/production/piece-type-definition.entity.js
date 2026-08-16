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
exports.PieceTypeDefinition = exports.PieceTypeArea = exports.PieceTypeStatus = void 0;
const typeorm_1 = require("typeorm");
var PieceTypeStatus;
(function (PieceTypeStatus) {
    PieceTypeStatus["DRAFT"] = "draft";
    PieceTypeStatus["PENDING_APPROVAL"] = "pending_approval";
    PieceTypeStatus["ACTIVE"] = "active";
    PieceTypeStatus["RETIRED"] = "retired";
})(PieceTypeStatus || (exports.PieceTypeStatus = PieceTypeStatus = {}));
var PieceTypeArea;
(function (PieceTypeArea) {
    PieceTypeArea["DESIGN"] = "design";
    PieceTypeArea["AUDIOVISUAL"] = "audiovisual";
})(PieceTypeArea || (exports.PieceTypeArea = PieceTypeArea = {}));
let PieceTypeDefinition = class PieceTypeDefinition {
};
exports.PieceTypeDefinition = PieceTypeDefinition;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PieceTypeDefinition.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], PieceTypeDefinition.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], PieceTypeDefinition.prototype, "key", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], PieceTypeDefinition.prototype, "label", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: PieceTypeArea.DESIGN }),
    __metadata("design:type", String)
], PieceTypeDefinition.prototype, "area", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ud_amount', type: 'decimal', precision: 8, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], PieceTypeDefinition.prototype, "udAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'xp_weight', type: 'decimal', precision: 5, scale: 2, default: 1 }),
    __metadata("design:type", Number)
], PieceTypeDefinition.prototype, "xpWeight", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'extra_per_unit', type: 'decimal', precision: 8, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], PieceTypeDefinition.prototype, "extraPerUnit", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_print', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], PieceTypeDefinition.prototype, "isPrint", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: PieceTypeStatus.DRAFT }),
    __metadata("design:type", String)
], PieceTypeDefinition.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'requested_by', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], PieceTypeDefinition.prototype, "requestedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'approved_by', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], PieceTypeDefinition.prototype, "approvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'approved_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], PieceTypeDefinition.prototype, "approvedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], PieceTypeDefinition.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PieceTypeDefinition.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PieceTypeDefinition.prototype, "updatedAt", void 0);
exports.PieceTypeDefinition = PieceTypeDefinition = __decorate([
    (0, typeorm_1.Entity)('piece_type_definitions'),
    (0, typeorm_1.Index)('UQ_piece_type_org_key', ['organizationId', 'key'], { unique: true })
], PieceTypeDefinition);
