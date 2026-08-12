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
exports.XPPeriod = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../users/user.entity");
let XPPeriod = class XPPeriod {
};
exports.XPPeriod = XPPeriod;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], XPPeriod.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], XPPeriod.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], XPPeriod.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], XPPeriod.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'week_start', type: 'date' }),
    __metadata("design:type", Date)
], XPPeriod.prototype, "weekStart", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'week_end', type: 'date' }),
    __metadata("design:type", Date)
], XPPeriod.prototype, "weekEnd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_xp', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], XPPeriod.prototype, "totalXp", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], XPPeriod.prototype, "tier", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'open' }),
    __metadata("design:type", String)
], XPPeriod.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'closed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], XPPeriod.prototype, "closedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], XPPeriod.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], XPPeriod.prototype, "updatedAt", void 0);
exports.XPPeriod = XPPeriod = __decorate([
    (0, typeorm_1.Entity)('xp_periods')
], XPPeriod);
//# sourceMappingURL=xp-period.entity.js.map