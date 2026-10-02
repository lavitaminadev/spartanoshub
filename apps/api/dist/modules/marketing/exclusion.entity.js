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
exports.ExclusionDeCorreo = void 0;
const typeorm_1 = require("typeorm");
let ExclusionDeCorreo = class ExclusionDeCorreo {
};
exports.ExclusionDeCorreo = ExclusionDeCorreo;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], ExclusionDeCorreo.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], ExclusionDeCorreo.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], ExclusionDeCorreo.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'char', length: 64 }),
    __metadata("design:type", String)
], ExclusionDeCorreo.prototype, "huella", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 10 }),
    __metadata("design:type", String)
], ExclusionDeCorreo.prototype, "alcance", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80, nullable: true }),
    __metadata("design:type", Object)
], ExclusionDeCorreo.prototype, "origen", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'pedida_el', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], ExclusionDeCorreo.prototype, "pedidaEl", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], ExclusionDeCorreo.prototype, "createdAt", void 0);
exports.ExclusionDeCorreo = ExclusionDeCorreo = __decorate([
    (0, typeorm_1.Entity)('email_suppression'),
    (0, typeorm_1.Index)('UQ_email_suppression_org_huella_client', ['organizationId', 'huella', 'clientId'], { unique: true }),
    (0, typeorm_1.Index)('IDX_email_suppression_org_huella', ['organizationId', 'huella'])
], ExclusionDeCorreo);
