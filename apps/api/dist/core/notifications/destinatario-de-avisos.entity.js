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
exports.DestinatarioDeAvisos = exports.TIPOS_DE_AVISO_VALIDOS = exports.TIPOS_DE_AVISO = void 0;
const typeorm_1 = require("typeorm");
exports.TIPOS_DE_AVISO = {
    reservas: { etiqueta: 'Reserva nueva', plantilla: 'email.team_new_reservation' },
    grupos: { etiqueta: 'Solicitud de grupo o evento', plantilla: 'email.team_group_request' },
    espera: { etiqueta: 'Lista de espera', plantilla: 'email.team_waitlist' },
    cambios: { etiqueta: 'El cliente canceló o cambió la hora', plantilla: 'email.team_guest_cancel' },
    encuestas: { etiqueta: 'Mensaje en una encuesta', plantilla: 'email.team_survey_message' },
    operacion: { etiqueta: 'Reservas pausadas o día cerrado', plantilla: null },
};
exports.TIPOS_DE_AVISO_VALIDOS = Object.keys(exports.TIPOS_DE_AVISO);
let DestinatarioDeAvisos = class DestinatarioDeAvisos {
    normalizar() {
        this.email = this.email?.trim().toLowerCase();
        this.name = this.name?.trim() || null;
        this.cargo = this.cargo?.trim() || null;
    }
    recibe(tipo) {
        return Array.isArray(this.tipos) && this.tipos.includes(tipo);
    }
};
exports.DestinatarioDeAvisos = DestinatarioDeAvisos;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], DestinatarioDeAvisos.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], DestinatarioDeAvisos.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], DestinatarioDeAvisos.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 190 }),
    __metadata("design:type", String)
], DestinatarioDeAvisos.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], DestinatarioDeAvisos.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], DestinatarioDeAvisos.prototype, "cargo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], DestinatarioDeAvisos.prototype, "tipos", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], DestinatarioDeAvisos.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], DestinatarioDeAvisos.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], DestinatarioDeAvisos.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.BeforeInsert)(),
    (0, typeorm_1.BeforeUpdate)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DestinatarioDeAvisos.prototype, "normalizar", null);
exports.DestinatarioDeAvisos = DestinatarioDeAvisos = __decorate([
    (0, typeorm_1.Entity)('team_notification_recipients'),
    (0, typeorm_1.Index)('UQ_team_recipients_org_client_email', ['organizationId', 'clientId', 'email'], { unique: true })
], DestinatarioDeAvisos);
