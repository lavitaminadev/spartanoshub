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
exports.UserClientAccess = void 0;
const typeorm_1 = require("typeorm");
let UserClientAccess = class UserClientAccess {
};
exports.UserClientAccess = UserClientAccess;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], UserClientAccess.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], UserClientAccess.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], UserClientAccess.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], UserClientAccess.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], UserClientAccess.prototype, "reason", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'granted_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], UserClientAccess.prototype, "grantedBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], UserClientAccess.prototype, "createdAt", void 0);
exports.UserClientAccess = UserClientAccess = __decorate([
    (0, typeorm_1.Entity)('user_client_access'),
    (0, typeorm_1.Index)('UQ_user_client_access_pair', ['userId', 'clientId'], { unique: true }),
    (0, typeorm_1.Index)('IDX_user_client_access_user', ['organizationId', 'userId'])
], UserClientAccess);
//# sourceMappingURL=user-client-access.entity.js.map