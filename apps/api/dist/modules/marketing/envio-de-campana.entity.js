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
exports.EnvioDeCampana = void 0;
const typeorm_1 = require("typeorm");
let EnvioDeCampana = class EnvioDeCampana {
};
exports.EnvioDeCampana = EnvioDeCampana;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], EnvioDeCampana.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], EnvioDeCampana.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'campana_id', type: 'uuid' }),
    __metadata("design:type", String)
], EnvioDeCampana.prototype, "campanaId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'suscriptor_id', type: 'uuid' }),
    __metadata("design:type", String)
], EnvioDeCampana.prototype, "suscriptorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 190 }),
    __metadata("design:type", String)
], EnvioDeCampana.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], EnvioDeCampana.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], EnvioDeCampana.prototype, "attempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'next_attempt_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], EnvioDeCampana.prototype, "nextAttemptAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_error', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], EnvioDeCampana.prototype, "lastError", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'processed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], EnvioDeCampana.prototype, "processedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], EnvioDeCampana.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], EnvioDeCampana.prototype, "updatedAt", void 0);
exports.EnvioDeCampana = EnvioDeCampana = __decorate([
    (0, typeorm_1.Entity)('email_campaign_sends'),
    (0, typeorm_1.Index)('IDX_email_campaign_sends_status', ['status', 'nextAttemptAt']),
    (0, typeorm_1.Index)('IDX_email_campaign_sends_campana', ['campanaId', 'status']),
    (0, typeorm_1.Index)('UQ_email_campaign_sends_campana_suscriptor', ['campanaId', 'suscriptorId'], { unique: true })
], EnvioDeCampana);
