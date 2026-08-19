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
exports.IngestLeadDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
function primeroDe(...alternativas) {
    for (const valor of alternativas) {
        if (typeof valor === 'string' && valor.trim())
            return valor.trim();
        if (typeof valor === 'number')
            return String(valor);
    }
    return undefined;
}
class IngestLeadDto {
}
exports.IngestLeadDto = IngestLeadDto;
__decorate([
    (0, class_transformer_1.Transform)(({ obj }) => primeroDe(obj.nombre, obj.name, obj.full_name, obj.fullName)),
    (0, class_validator_1.IsString)({ message: 'Falta el nombre. Mapea el campo `nombre` (o `name`) en tu Zap.' }),
    (0, class_validator_1.MaxLength)(180),
    __metadata("design:type", String)
], IngestLeadDto.prototype, "nombre", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ obj }) => primeroDe(obj.telefono, obj.phone, obj.celular, obj.mobile, obj.phone_number)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], IngestLeadDto.prototype, "telefono", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ obj }) => primeroDe(obj.email, obj.correo, obj.mail)?.toLowerCase()),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)({}, { message: 'El correo no tiene forma de correo. Revisa el campo que mapeaste.' }),
    (0, class_validator_1.MaxLength)(180),
    __metadata("design:type", String)
], IngestLeadDto.prototype, "email", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ obj }) => primeroDe(obj.idExterno, obj.external_id, obj.externalId, obj.id)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], IngestLeadDto.prototype, "idExterno", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ obj }) => primeroDe(obj.campana, obj.campaign, obj.utm_campaign)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(180),
    __metadata("design:type", String)
], IngestLeadDto.prototype, "campana", void 0);
__decorate([
    (0, class_transformer_1.Transform)(({ obj }) => primeroDe(obj.mensaje, obj.message, obj.notas, obj.notes, obj.comentario)),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(2000),
    __metadata("design:type", String)
], IngestLeadDto.prototype, "mensaje", void 0);
