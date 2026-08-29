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
exports.Reservation = void 0;
const typeorm_1 = require("typeorm");
let Reservation = class Reservation {
};
exports.Reservation = Reservation;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Reservation.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Reservation.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], Reservation.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'form_id', type: 'uuid' }),
    __metadata("design:type", String)
], Reservation.prototype, "formId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'contact_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "contactId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reference_code', type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], Reservation.prototype, "referenceCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'idempotency_key', type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "idempotencyKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 24, default: 'confirmed' }),
    __metadata("design:type", String)
], Reservation.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'workflow_state', type: 'varchar', length: 20, default: 'draft' }),
    __metadata("design:type", String)
], Reservation.prototype, "workflowState", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'starts_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], Reservation.prototype, "startsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ends_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], Reservation.prototype, "endsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'party_size', type: 'smallint', default: 1 }),
    __metadata("design:type", Number)
], Reservation.prototype, "partySize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'service_id', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "serviceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resource_id', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "resourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'guest_name', type: 'varchar', length: 180 }),
    __metadata("design:type", String)
], Reservation.prototype, "guestName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'guest_email', type: 'varchar', length: 190, nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "guestEmail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'guest_phone', type: 'varchar', length: 50, nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "guestPhone", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'answers', type: 'json' }),
    __metadata("design:type", Object)
], Reservation.prototype, "answers", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'consent_version', type: 'varchar', length: 30, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "consentVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'adult_declared_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "adultDeclaredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'internal_notes', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "internalNotes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'utm_source', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "utmSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'utm_medium', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "utmMedium", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'utm_campaign', type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "utmCampaign", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'utm_content', type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "utmContent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'click_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "clickId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gclid', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "gclid", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gbraid', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "gbraid", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'wbraid', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "wbraid", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fbclid', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "fbclid", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fbc', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "fbc", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'fbp', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "fbp", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_ip_address', type: 'varchar', length: 100, nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "clientIpAddress", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_user_agent', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", Object)
], Reservation.prototype, "clientUserAgent", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'calendar_event_id', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "calendarEventId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'calendar_url', type: 'varchar', length: 500, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "calendarUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'coupon_code', type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", String)
], Reservation.prototype, "couponCode", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Reservation.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Reservation.prototype, "updatedAt", void 0);
exports.Reservation = Reservation = __decorate([
    (0, typeorm_1.Entity)('reservations'),
    (0, typeorm_1.Index)('IDX_reservations_form_start', ['formId', 'startsAt']),
    (0, typeorm_1.Index)('UQ_reservations_form_idempotency', ['formId', 'idempotencyKey'], { unique: true }),
    (0, typeorm_1.Index)('IDX_reservations_contact', ['contactId']),
    (0, typeorm_1.Index)('IDX_reservations_org_client_starts', ['organizationId', 'clientId', 'startsAt'])
], Reservation);
