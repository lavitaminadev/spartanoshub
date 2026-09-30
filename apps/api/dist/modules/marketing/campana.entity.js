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
exports.Campana = exports.EstadoDeCampana = void 0;
const typeorm_1 = require("typeorm");
var EstadoDeCampana;
(function (EstadoDeCampana) {
    EstadoDeCampana["BORRADOR"] = "draft";
    EstadoDeCampana["ENVIANDO"] = "sending";
    EstadoDeCampana["ENVIADA"] = "sent";
})(EstadoDeCampana || (exports.EstadoDeCampana = EstadoDeCampana = {}));
let Campana = class Campana {
};
exports.Campana = Campana;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Campana.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'organization_id', type: 'uuid' }),
    __metadata("design:type", String)
], Campana.prototype, "organizationId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'client_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Campana.prototype, "clientId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 200 }),
    __metadata("design:type", String)
], Campana.prototype, "asunto", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Campana.prototype, "cuerpo", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: EstadoDeCampana.BORRADOR }),
    __metadata("design:type", String)
], Campana.prototype, "estado", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Campana.prototype, "destinatarios", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Campana.prototype, "enviados", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'sent_at', type: 'timestamp', nullable: true }),
    __metadata("design:type", Object)
], Campana.prototype, "sentAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'created_by', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Campana.prototype, "createdBy", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], Campana.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], Campana.prototype, "updatedAt", void 0);
exports.Campana = Campana = __decorate([
    (0, typeorm_1.Entity)('email_campaigns'),
    (0, typeorm_1.Index)('IDX_email_campaigns_org_client', ['organizationId', 'clientId'])
], Campana);
