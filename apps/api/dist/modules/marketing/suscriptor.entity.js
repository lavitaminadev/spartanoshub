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
exports.Suscriptor = exports.EstadoDeSuscripcion = void 0;
const typeorm_1 = require("typeorm");
const edad_1 = require("./edad");
var EstadoDeSuscripcion;
(function (EstadoDeSuscripcion) {
    EstadoDeSuscripcion["PENDIENTE"] = "pending";
    EstadoDeSuscripcion["SUSCRITO"] = "subscribed";
    EstadoDeSuscripcion["BAJA"] = "unsubscribed";
})(EstadoDeSuscripcion || (exports.EstadoDeSuscripcion = EstadoDeSuscripcion = {}));
let Suscriptor = class Suscriptor {
    normalizar() {
        this.email = this.email?.trim().toLowerCase();
        this.name = this.name?.trim() || null;
    }
    puedeRecibirCampana(hoy = new Date()) {
        if (this.status !== EstadoDeSuscripcion.SUSCRITO)
            return false;
        if (this.adultDeclaredAt)
            return true;
        return (0, edad_1.puedeRecibirPorEdad)(this.birthDate, hoy);
    }
};
exports.Suscriptor = Suscriptor;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Suscriptor.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Suscriptor.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Suscriptor.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 190 }),
    __metadata("design:type", String)
], Suscriptor.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 180, nullable: true }),
    __metadata("design:type", Object)
], Suscriptor.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'birth_date', type: 'date', nullable: true }),
    __metadata("design:type", Object)
], Suscriptor.prototype, "birthDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: EstadoDeSuscripcion.PENDIENTE }),
    __metadata("design:type", String)
], Suscriptor.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120 }),
    __metadata("design:type", String)
], Suscriptor.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_detail', type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], Suscriptor.prototype, "sourceDetail", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'consent_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Suscriptor.prototype, "consentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'consent_text', type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Suscriptor.prototype, "consentText", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'adult_declared_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Suscriptor.prototype, "adultDeclaredAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'consent_ip', type: 'varchar', length: 45, nullable: true }),
    __metadata("design:type", Object)
], Suscriptor.prototype, "consentIp", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unsubscribed_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Suscriptor.prototype, "unsubscribedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'unsubscribe_token', type: 'varchar', length: 64, unique: true }),
    __metadata("design:type", String)
], Suscriptor.prototype, "unsubscribeToken", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_sent_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Suscriptor.prototype, "lastSentAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Suscriptor.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Suscriptor.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    (0, typeorm_1.BeforeUpdate)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], Suscriptor.prototype, "normalizar", null);
exports.Suscriptor = Suscriptor = __decorate([
    (0, typeorm_1.Entity)('email_subscribers'),
    (0, typeorm_1.Index)('UQ_email_subscribers_org_email', ['organizationId', 'email'], { unique: true }),
    (0, typeorm_1.Index)('IDX_email_subscribers_org_status', ['organizationId', 'status']),
    (0, typeorm_1.Index)('IDX_email_subscribers_token', ['unsubscribeToken'])
], Suscriptor);
