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
exports.PerfilAsignacion = void 0;
const typeorm_1 = require("typeorm");
let PerfilAsignacion = class PerfilAsignacion {
};
exports.PerfilAsignacion = PerfilAsignacion;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PerfilAsignacion.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], PerfilAsignacion.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], PerfilAsignacion.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], PerfilAsignacion.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'perfil_id', type: 'uuid' }),
    __metadata("design:type", String)
], PerfilAsignacion.prototype, "perfilId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'assigned_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PerfilAsignacion.prototype, "asignadoPor", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PerfilAsignacion.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PerfilAsignacion.prototype, "updatedAt", void 0);
exports.PerfilAsignacion = PerfilAsignacion = __decorate([
    (0, typeorm_1.Entity)('perfil_asignaciones'),
    (0, typeorm_1.Index)('UQ_perfil_asignacion', ['clientId', 'userId'], { unique: true }),
    (0, typeorm_1.Index)('IDX_perfil_asignacion_perfil', ['perfilId'])
], PerfilAsignacion);
