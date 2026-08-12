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
exports.XPDispute = void 0;
const typeorm_1 = require("typeorm");
const xp_period_entity_1 = require("./xp-period.entity");
const user_entity_1 = require("../users/user.entity");
let XPDispute = class XPDispute {
};
exports.XPDispute = XPDispute;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], XPDispute.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], XPDispute.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'xp_period_id', type: 'uuid' }),
    __metadata("design:type", String)
], XPDispute.prototype, "xpPeriodId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => xp_period_entity_1.XPPeriod, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'xp_period_id' }),
    __metadata("design:type", xp_period_entity_1.XPPeriod)
], XPDispute.prototype, "period", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], XPDispute.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], XPDispute.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], XPDispute.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], XPDispute.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], XPDispute.prototype, "resolution", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'adjustment_points', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], XPDispute.prototype, "adjustmentPoints", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_by', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], XPDispute.prototype, "resolvedBy", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'resolved_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], XPDispute.prototype, "resolvedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], XPDispute.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], XPDispute.prototype, "updatedAt", void 0);
exports.XPDispute = XPDispute = __decorate([
    (0, typeorm_1.Entity)('xp_disputes'),
    (0, typeorm_1.Index)('IDX_xp_disputes_org_status', ['organizationId', 'status'])
], XPDispute);
