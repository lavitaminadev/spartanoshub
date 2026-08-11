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
exports.ReservationCoupon = void 0;
const typeorm_1 = require("typeorm");
let ReservationCoupon = class ReservationCoupon {
};
exports.ReservationCoupon = ReservationCoupon;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReservationCoupon.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationCoupon.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], ReservationCoupon.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], ReservationCoupon.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'discount_type', type: 'varchar', length: 20, default: 'percentage' }),
    __metadata("design:type", String)
], ReservationCoupon.prototype, "discountType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'smallint', default: 0 }),
    __metadata("design:type", Number)
], ReservationCoupon.prototype, "value", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_uses', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ReservationCoupon.prototype, "maxUses", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'usage_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], ReservationCoupon.prototype, "usageCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'valid_from', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ReservationCoupon.prototype, "validFrom", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'valid_until', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], ReservationCoupon.prototype, "validUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'form_ids', type: 'json', nullable: true }),
    __metadata("design:type", Array)
], ReservationCoupon.prototype, "formIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'valid_days_of_week', type: 'json', nullable: true }),
    __metadata("design:type", Array)
], ReservationCoupon.prototype, "validDaysOfWeek", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'valid_from_time', type: 'varchar', length: 5, nullable: true }),
    __metadata("design:type", String)
], ReservationCoupon.prototype, "validFromTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'valid_until_time', type: 'varchar', length: 5, nullable: true }),
    __metadata("design:type", String)
], ReservationCoupon.prototype, "validUntilTime", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], ReservationCoupon.prototype, "active", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReservationCoupon.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], ReservationCoupon.prototype, "updatedAt", void 0);
exports.ReservationCoupon = ReservationCoupon = __decorate([
    (0, typeorm_1.Entity)('reservation_coupons'),
    (0, typeorm_1.Index)('UQ_reservation_coupons_code_org', ['code', 'organizationId'], { unique: true })
], ReservationCoupon);
//# sourceMappingURL=reservation-coupon.entity.js.map