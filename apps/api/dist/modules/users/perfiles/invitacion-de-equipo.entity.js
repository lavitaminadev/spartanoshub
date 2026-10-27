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
exports.InvitacionDeEquipo = void 0;
const typeorm_1 = require("typeorm");
let InvitacionDeEquipo = class InvitacionDeEquipo {
};
exports.InvitacionDeEquipo = InvitacionDeEquipo;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], InvitacionDeEquipo.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], InvitacionDeEquipo.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], InvitacionDeEquipo.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], InvitacionDeEquipo.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'perfil_id', type: 'uuid' }),
    __metadata("design:type", String)
], InvitacionDeEquipo.prototype, "perfilId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_hash', type: 'varchar', length: 64 }),
    __metadata("design:type", String)
], InvitacionDeEquipo.prototype, "tokenHash", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'invited_by', type: 'uuid' }),
    __metadata("design:type", String)
], InvitacionDeEquipo.prototype, "invitadoPor", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'expires_at', type: 'timestamp' }),
    __metadata("design:type", Date)
], InvitacionDeEquipo.prototype, "venceEl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'accepted_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], InvitacionDeEquipo.prototype, "aceptadaEl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'revoked_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], InvitacionDeEquipo.prototype, "revocadaEl", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'lifts_ban', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], InvitacionDeEquipo.prototype, "levantaVeto", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'reentry_reason', type: 'varchar', length: 300, nullable: true }),
    __metadata("design:type", Object)
], InvitacionDeEquipo.prototype, "motivoReingreso", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], InvitacionDeEquipo.prototype, "createdAt", void 0);
exports.InvitacionDeEquipo = InvitacionDeEquipo = __decorate([
    (0, typeorm_1.Entity)('invitaciones_equipo'),
    (0, typeorm_1.Index)('IDX_invitacion_empresa_correo', ['clientId', 'email']),
    (0, typeorm_1.Index)('UQ_invitacion_token', ['tokenHash'], { unique: true })
], InvitacionDeEquipo);
