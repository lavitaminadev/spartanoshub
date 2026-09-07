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
exports.ReservationManagementToken = void 0;
const typeorm_1 = require("typeorm");
let ReservationManagementToken = class ReservationManagementToken {
};
exports.ReservationManagementToken = ReservationManagementToken;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ReservationManagementToken.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reservation_id', type: 'uuid' }),
    __metadata("design:type", String)
], ReservationManagementToken.prototype, "reservationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_hash', type: 'char', length: 64 }),
    __metadata("design:type", String)
], ReservationManagementToken.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], ReservationManagementToken.prototype, "expiresAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'revoked_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ReservationManagementToken.prototype, "revokedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'used_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], ReservationManagementToken.prototype, "usedAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ReservationManagementToken.prototype, "createdAt", void 0);
exports.ReservationManagementToken = ReservationManagementToken = __decorate([
    (0, typeorm_1.Entity)('reservation_management_tokens'),
    (0, typeorm_1.Index)('UQ_reservation_management_token_hash', ['tokenHash'], { unique: true }),
    (0, typeorm_1.Index)('IDX_reservation_management_reservation', ['reservationId'])
], ReservationManagementToken);
