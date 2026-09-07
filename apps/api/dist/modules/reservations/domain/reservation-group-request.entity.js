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
exports.ReservationGroupRequest = void 0;
const typeorm_1 = require("typeorm");
let ReservationGroupRequest = class ReservationGroupRequest {
};
exports.ReservationGroupRequest = ReservationGroupRequest;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReservationGroupRequest.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationGroupRequest.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationGroupRequest.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'form_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationGroupRequest.prototype, "formId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'idempotency_key', type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], ReservationGroupRequest.prototype, "idempotencyKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'guest_name', type: 'varchar', length: 180 }),
    __metadata("design:type", String)
], ReservationGroupRequest.prototype, "guestName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'guest_email', type: 'varchar', length: 190, nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "guestEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'guest_phone', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "guestPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'party_size', type: 'smallint' }),
    __metadata("design:type", Number)
], ReservationGroupRequest.prototype, "partySize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'event_type', type: 'varchar', length: 30 }),
    __metadata("design:type", String)
], ReservationGroupRequest.prototype, "eventType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'preferred_date', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "preferredDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'preferred_time', type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "preferredTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "notes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quote_amount', type: 'decimal', precision: 12, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "quoteAmount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quote_message', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "quoteMessage", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'quote_expires_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "quoteExpiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reservation_consent_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "reservationConsentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reservation_consent_text', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "reservationConsentText", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketing_consent_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "marketingConsentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'marketing_consent_text', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "marketingConsentText", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'utm_source', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "utmSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'utm_campaign', type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", Object)
], ReservationGroupRequest.prototype, "utmCampaign", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], ReservationGroupRequest.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReservationGroupRequest.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ReservationGroupRequest.prototype, "updatedAt", void 0);
exports.ReservationGroupRequest = ReservationGroupRequest = __decorate([
    (0, typeorm_1.Entity)('reservation_group_requests'),
    (0, typeorm_1.Index)('IDX_reservation_group_requests_form_status', ['formId', 'status', 'createdAt']),
    (0, typeorm_1.Index)('UQ_reservation_group_request_idempotency', ['formId', 'idempotencyKey'], { unique: true })
], ReservationGroupRequest);
