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
exports.ReservationEvent = void 0;
const typeorm_1 = require("typeorm");
let ReservationEvent = class ReservationEvent {
};
exports.ReservationEvent = ReservationEvent;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReservationEvent.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationEvent.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationEvent.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reservation_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationEvent.prototype, "reservationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], ReservationEvent.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'from_status', type: 'varchar', length: 24, nullable: true }),
    __metadata("design:type", String)
], ReservationEvent.prototype, "fromStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'to_status', type: 'varchar', length: 24, nullable: true }),
    __metadata("design:type", String)
], ReservationEvent.prototype, "toStatus", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actor_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ReservationEvent.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actor_type', type: 'varchar', length: 20, default: 'system' }),
    __metadata("design:type", String)
], ReservationEvent.prototype, "actorType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], ReservationEvent.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReservationEvent.prototype, "createdAt", void 0);
exports.ReservationEvent = ReservationEvent = __decorate([
    (0, typeorm_1.Entity)('reservation_events'),
    (0, typeorm_1.Index)('IDX_reservation_events_reservation', ['reservationId', 'createdAt'])
], ReservationEvent);
