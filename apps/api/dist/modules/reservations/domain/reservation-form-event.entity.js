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
exports.ReservationFormEvent = void 0;
const typeorm_1 = require("typeorm");
let ReservationFormEvent = class ReservationFormEvent {
};
exports.ReservationFormEvent = ReservationFormEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReservationFormEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationFormEvent.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationFormEvent.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'form_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationFormEvent.prototype, "formId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], ReservationFormEvent.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'session_id', type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", String)
], ReservationFormEvent.prototype, "sessionId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'utm_source', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", String)
], ReservationFormEvent.prototype, "utmSource", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'utm_campaign', type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", String)
], ReservationFormEvent.prototype, "utmCampaign", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], ReservationFormEvent.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReservationFormEvent.prototype, "createdAt", void 0);
exports.ReservationFormEvent = ReservationFormEvent = __decorate([
    (0, typeorm_1.Entity)('reservation_form_events'),
    (0, typeorm_1.Index)('IDX_reservation_form_events_form_date', ['formId', 'createdAt']),
    (0, typeorm_1.Index)('UQ_reservation_form_event_session', ['formId', 'type', 'sessionId'], { unique: true })
], ReservationFormEvent);
