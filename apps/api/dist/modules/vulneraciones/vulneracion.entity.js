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
exports.Vulneracion = void 0;
const typeorm_1 = require("typeorm");
let Vulneracion = class Vulneracion {
};
exports.Vulneracion = Vulneracion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Vulneracion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Vulneracion.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Vulneracion.prototype, "descripcion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'detected_at', type: 'datetime' }),
    __metadata("design:type", Date)
], Vulneracion.prototype, "detectedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'datos_afectados', type: 'text' }),
    __metadata("design:type", String)
], Vulneracion.prototype, "datosAfectados", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'titulares_afectados', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], Vulneracion.prototype, "titularesAfectados", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_ids', type: 'json' }),
    __metadata("design:type", Array)
], Vulneracion.prototype, "clientIds", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], Vulneracion.prototype, "medidas", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'aviso_local_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], Vulneracion.prototype, "avisoLocalAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'aviso_agencia_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], Vulneracion.prototype, "avisoAgenciaAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Vulneracion.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Vulneracion.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Vulneracion.prototype, "updatedAt", void 0);
exports.Vulneracion = Vulneracion = __decorate([
    (0, typeorm_1.Entity)('security_incidents'),
    (0, typeorm_1.Index)('IDX_security_incidents_org_detected', ['organizationId', 'detectedAt'])
], Vulneracion);
