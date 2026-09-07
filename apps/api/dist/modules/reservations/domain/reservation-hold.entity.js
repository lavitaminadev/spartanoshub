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
exports.ReservationHold = void 0;
const typeorm_1 = require("typeorm");
let ReservationHold = class ReservationHold {
};
exports.ReservationHold = ReservationHold;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReservationHold.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'form_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationHold.prototype, "formId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'hold_key', type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], ReservationHold.prototype, "holdKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'starts_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], ReservationHold.prototype, "startsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ends_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], ReservationHold.prototype, "endsAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'party_size', type: 'smallint' }),
    __metadata("design:type", Number)
], ReservationHold.prototype, "partySize", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'service_id', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", String)
], ReservationHold.prototype, "serviceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resource_id', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", String)
], ReservationHold.prototype, "resourceId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], ReservationHold.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReservationHold.prototype, "createdAt", void 0);
exports.ReservationHold = ReservationHold = __decorate([
    (0, typeorm_1.Entity)('reservation_holds'),
    (0, typeorm_1.Index)('UQ_reservation_hold_form_key', ['formId', 'holdKey'], { unique: true }),
    (0, typeorm_1.Index)('IDX_reservation_hold_active', ['formId', 'expiresAt'])
], ReservationHold);
