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
exports.RegistroDeCorreo = void 0;
const typeorm_1 = require("typeorm");
let RegistroDeCorreo = class RegistroDeCorreo {
};
exports.RegistroDeCorreo = RegistroDeCorreo;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], RegistroDeCorreo.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 320 }),
    __metadata("design:type", String)
], RegistroDeCorreo.prototype, "destinatario", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], RegistroDeCorreo.prototype, "asunto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 12 }),
    __metadata("design:type", String)
], RegistroDeCorreo.prototype, "resultado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], RegistroDeCorreo.prototype, "motivo", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], RegistroDeCorreo.prototype, "createdAt", void 0);
exports.RegistroDeCorreo = RegistroDeCorreo = __decorate([
    (0, typeorm_1.Entity)('registro_de_correos'),
    (0, typeorm_1.Index)('IDX_registro_de_correos_fecha', ['createdAt'])
], RegistroDeCorreo);
