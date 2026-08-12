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
exports.MetaConversionOutbox = void 0;
const typeorm_1 = require("typeorm");
let MetaConversionOutbox = class MetaConversionOutbox {
};
exports.MetaConversionOutbox = MetaConversionOutbox;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], MetaConversionOutbox.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], MetaConversionOutbox.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_id', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], MetaConversionOutbox.prototype, "eventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pixel_id', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], MetaConversionOutbox.prototype, "pixelId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_data', type: 'json' }),
    __metadata("design:type", Object)
], MetaConversionOutbox.prototype, "eventData", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], MetaConversionOutbox.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], MetaConversionOutbox.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_attempt_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], MetaConversionOutbox.prototype, "nextAttemptAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", String)
], MetaConversionOutbox.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], MetaConversionOutbox.prototype, "processedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], MetaConversionOutbox.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], MetaConversionOutbox.prototype, "updatedAt", void 0);
exports.MetaConversionOutbox = MetaConversionOutbox = __decorate([
    (0, typeorm_1.Entity)('meta_conversion_outbox'),
    (0, typeorm_1.Index)('UQ_meta_conversion_event', ['organizationId', 'eventId'], { unique: true })
], MetaConversionOutbox);
