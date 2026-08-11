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
exports.UserPermissionOverride = void 0;
const typeorm_1 = require("typeorm");
let UserPermissionOverride = class UserPermissionOverride {
};
exports.UserPermissionOverride = UserPermissionOverride;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserPermissionOverride.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], UserPermissionOverride.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], UserPermissionOverride.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 60 }),
    __metadata("design:type", String)
], UserPermissionOverride.prototype, "module", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20 }),
    __metadata("design:type", String)
], UserPermissionOverride.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 300, nullable: true }),
    __metadata("design:type", Object)
], UserPermissionOverride.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'granted_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserPermissionOverride.prototype, "grantedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserPermissionOverride.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], UserPermissionOverride.prototype, "updatedAt", void 0);
exports.UserPermissionOverride = UserPermissionOverride = __decorate([
    (0, typeorm_1.Entity)('user_permission_overrides'),
    (0, typeorm_1.Index)('UQ_user_permission_override', ['userId', 'module'], { unique: true })
], UserPermissionOverride);
//# sourceMappingURL=user-permission-override.entity.js.map