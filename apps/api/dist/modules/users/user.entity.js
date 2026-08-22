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
exports.User = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
const user_role_enum_1 = require("../organizations/user-role.enum");
let User = class User {
    normalize() {
        this.name = this.name?.trim();
        this.email = this.email?.trim().toLowerCase();
        this.phone = this.phone?.replace(/[^\d+]/g, '') || null;
    }
};
exports.User = User;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], User.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], User.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'organization_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], User.prototype, "organization", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], User.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, unique: true }),
    __metadata("design:type", String)
], User.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, select: false }),
    __metadata("design:type", String)
], User.prototype, "password", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 50, default: user_role_enum_1.UserRole.DESIGNER }),
    __metadata("design:type", String)
], User.prototype, "role", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'avatar_url', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "avatarUrl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'is_active', type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], User.prototype, "isActive", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", String)
], User.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'crm_profile', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "crmProfile", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'work_mode', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", String)
], User.prototype, "workMode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'weekly_capacity_ud', type: 'decimal', precision: 8, scale: 2, default: 20 }),
    __metadata("design:type", Number)
], User.prototype, "weeklyCapacityUd", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'must_change_password', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "mustChangePassword", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invited_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "invitedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'password_changed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Date)
], User.prototype, "passwordChangedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'failed_login_attempts', type: 'smallint', default: 0 }),
    __metadata("design:type", Number)
], User.prototype, "failedLoginAttempts", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'locked_until', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "lockedUntil", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_login_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "lastLoginAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'terms_accepted_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "termsAcceptedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'terms_version', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], User.prototype, "termsVersion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'must_complete_profile', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], User.prototype, "mustCompleteProfile", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'refresh_token', type: 'text', nullable: true, select: false }),
    __metadata("design:type", Object)
], User.prototype, "refreshToken", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], User.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], User.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    (0, typeorm_1.BeforeUpdate)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], User.prototype, "normalize", null);
exports.User = User = __decorate([
    (0, typeorm_1.Entity)('users')
], User);
