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
exports.PerfilDeEmpresa = void 0;
const typeorm_1 = require("typeorm");
let PerfilDeEmpresa = class PerfilDeEmpresa {
};
exports.PerfilDeEmpresa = PerfilDeEmpresa;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], PerfilDeEmpresa.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], PerfilDeEmpresa.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid' }),
    __metadata("design:type", String)
], PerfilDeEmpresa.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'name', type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], PerfilDeEmpresa.prototype, "nombre", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'description', type: 'varchar', length: 300, nullable: true }),
    __metadata("design:type", Object)
], PerfilDeEmpresa.prototype, "descripcion", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json' }),
    __metadata("design:type", Object)
], PerfilDeEmpresa.prototype, "areas", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'protected_data', type: 'json' }),
    __metadata("design:type", Object)
], PerfilDeEmpresa.prototype, "datosProtegidos", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], PerfilDeEmpresa.prototype, "creadoPor", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], PerfilDeEmpresa.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], PerfilDeEmpresa.prototype, "updatedAt", void 0);
exports.PerfilDeEmpresa = PerfilDeEmpresa = __decorate([
    (0, typeorm_1.Entity)('perfiles'),
    (0, typeorm_1.Index)('UQ_perfil_empresa_nombre', ['clientId', 'nombre'], { unique: true })
], PerfilDeEmpresa);
