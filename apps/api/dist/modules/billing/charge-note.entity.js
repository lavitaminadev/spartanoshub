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
exports.ChargeNote = void 0;
const typeorm_1 = require("typeorm");
let ChargeNote = class ChargeNote {
};
exports.ChargeNote = ChargeNote;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ChargeNote.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ChargeNote.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], ChargeNote.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'piece_id', type: 'uuid' }),
    __metadata("design:type", String)
], ChargeNote.prototype, "pieceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'correction_id', type: 'uuid' }),
    __metadata("design:type", String)
], ChargeNote.prototype, "correctionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 30, default: 'pending_pricing' }),
    __metadata("design:type", String)
], ChargeNote.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 18, scale: 2, nullable: true }),
    __metadata("design:type", Number)
], ChargeNote.prototype, "amount", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'char', length: 3, default: 'CLP' }),
    __metadata("design:type", String)
], ChargeNote.prototype, "currency", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], ChargeNote.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invoice_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ChargeNote.prototype, "invoiceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ChargeNote.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ChargeNote.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ChargeNote.prototype, "updatedAt", void 0);
exports.ChargeNote = ChargeNote = __decorate([
    (0, typeorm_1.Entity)('charge_notes'),
    (0, typeorm_1.Index)('UQ_charge_notes_correction', ['correctionId'], { unique: true }),
    (0, typeorm_1.Index)('IDX_charge_notes_org_created', ['organizationId', 'createdAt'])
], ChargeNote);
//# sourceMappingURL=charge-note.entity.js.map