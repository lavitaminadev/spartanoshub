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
exports.ReservationCouponRedemption = void 0;
const typeorm_1 = require("typeorm");
let ReservationCouponRedemption = class ReservationCouponRedemption {
};
exports.ReservationCouponRedemption = ReservationCouponRedemption;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReservationCouponRedemption.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationCouponRedemption.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ReservationCouponRedemption.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'coupon_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationCouponRedemption.prototype, "couponId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 40 }),
    __metadata("design:type", String)
], ReservationCouponRedemption.prototype, "codigo", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reservation_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ReservationCouponRedemption.prototype, "reservationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'form_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ReservationCouponRedemption.prototype, "formId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'reserva' }),
    __metadata("design:type", String)
], ReservationCouponRedemption.prototype, "canal", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 14, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ReservationCouponRedemption.prototype, "monto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'decimal', precision: 14, scale: 2, nullable: true }),
    __metadata("design:type", Object)
], ReservationCouponRedemption.prototype, "descuento", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 190, nullable: true }),
    __metadata("design:type", Object)
], ReservationCouponRedemption.prototype, "persona", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 300, nullable: true }),
    __metadata("design:type", Object)
], ReservationCouponRedemption.prototype, "nota", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'registrado_por', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ReservationCouponRedemption.prototype, "registradoPor", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReservationCouponRedemption.prototype, "createdAt", void 0);
exports.ReservationCouponRedemption = ReservationCouponRedemption = __decorate([
    (0, typeorm_1.Entity)('reservation_coupon_redemptions'),
    (0, typeorm_1.Index)('IDX_coupon_redemptions_cupon', ['couponId', 'createdAt'])
], ReservationCouponRedemption);
