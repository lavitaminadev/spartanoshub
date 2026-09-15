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
exports.CompanyLegalScopeDto = exports.CompanyLegalDto = void 0;
exports.leerDatosLegales = leerDatosLegales;
exports.guardarDatosLegales = guardarDatosLegales;
exports.empresaDelPortal = empresaDelPortal;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const shared_1 = require("@espartanos/shared");
class CompanyLegalDto {
}
exports.CompanyLegalDto = CompanyLegalDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", Object)
], CompanyLegalDto.prototype, "legalName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", Object)
], CompanyLegalDto.prototype, "taxId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.MaxLength)(190),
    __metadata("design:type", Object)
], CompanyLegalDto.prototype, "privacyEmail", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ protocols: ['https'], require_protocol: true }),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], CompanyLegalDto.prototype, "privacyUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ protocols: ['https'], require_protocol: true }),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", Object)
], CompanyLegalDto.prototype, "termsUrl", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['enlace', 'texto']),
    __metadata("design:type", String)
], CompanyLegalDto.prototype, "legalMode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30000),
    __metadata("design:type", Object)
], CompanyLegalDto.prototype, "privacyText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30000),
    __metadata("design:type", Object)
], CompanyLegalDto.prototype, "termsText", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CompanyLegalDto.prototype, "aceptaEncargo", void 0);
class CompanyLegalScopeDto {
}
exports.CompanyLegalScopeDto = CompanyLegalScopeDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CompanyLegalScopeDto.prototype, "clientId", void 0);
async function leerDatosLegales(db, organizationId, clientId) {
    const filas = await db.query('SELECT legal_name, tax_id, privacy_email, privacy_url, terms_url, legal_mode, privacy_text, terms_text, encargo_version, encargo_accepted_at, encargo_accepted_name FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]);
    const fila = filas?.[0];
    if (!fila)
        throw new common_1.NotFoundException('Empresa no encontrada');
    const aceptadoEn = fila.encargo_accepted_at ? new Date(fila.encargo_accepted_at).toISOString() : null;
    return {
        legalName: fila.legal_name, taxId: fila.tax_id, privacyEmail: fila.privacy_email, privacyUrl: fila.privacy_url, termsUrl: fila.terms_url, legalMode: fila.legal_mode === 'texto' ? 'texto' : 'enlace', privacyText: fila.privacy_text, termsText: fila.terms_text,
        encargo: { version: fila.encargo_version ?? null, aceptadoEn, aceptadoPor: fila.encargo_accepted_name ?? null, vigente: fila.encargo_version === shared_1.VERSION_DOCUMENTOS_LEGALES, versionVigente: shared_1.VERSION_DOCUMENTOS_LEGALES },
    };
}
async function guardarDatosLegales(db, audit, organizationId, clientId, dto, actorId, actorName) {
    const antes = await leerDatosLegales(db, organizationId, clientId);
    const limpio = (valor) => (typeof valor === 'string' && valor.trim() ? valor.trim() : null);
    await db.query('UPDATE clients SET legal_name = ?, tax_id = ?, privacy_email = ?, privacy_url = ?, terms_url = ?, legal_mode = ?, privacy_text = ?, terms_text = ? WHERE id = ? AND organization_id = ?', [limpio(dto.legalName), limpio(dto.taxId), limpio(dto.privacyEmail), limpio(dto.privacyUrl), limpio(dto.termsUrl), dto.legalMode === 'texto' ? 'texto' : 'enlace', limpio(dto.privacyText), limpio(dto.termsText), clientId, organizationId]);
    await audit.log({ organizationId, actorId, entityType: 'ClientLegalData', entityId: clientId, action: 'updated', before: antes, after: dto });
    if (dto.aceptaEncargo === true && !antes.encargo.vigente) {
        await db.query('UPDATE clients SET encargo_version = ?, encargo_accepted_at = ?, encargo_accepted_by = ?, encargo_accepted_name = ? WHERE id = ? AND organization_id = ?', [shared_1.VERSION_DOCUMENTOS_LEGALES, new Date(), actorId, actorName?.slice(0, 180) ?? null, clientId, organizationId]);
        await audit.log({ organizationId, actorId, entityType: 'ClientDataProcessingAgreement', entityId: clientId, action: 'accepted', after: { version: shared_1.VERSION_DOCUMENTOS_LEGALES } });
    }
    return leerDatosLegales(db, organizationId, clientId);
}
function empresaDelPortal(clientId) {
    if (!clientId)
        throw new common_1.ForbiddenException('La cuenta no pertenece a una empresa');
    return clientId;
}
