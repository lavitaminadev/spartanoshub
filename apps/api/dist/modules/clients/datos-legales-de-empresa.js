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
exports.asegurarQueAdministraLaEmpresa = asegurarQueAdministraLaEmpresa;
exports.leerDatosLegales = leerDatosLegales;
exports.leerHistorialLegal = leerHistorialLegal;
exports.guardarDatosLegales = guardarDatosLegales;
exports.empresaDelPortal = empresaDelPortal;
exports.empresaDeLosDatosLegales = empresaDeLosDatosLegales;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const shared_1 = require("@espartanos/shared");
const node_crypto_1 = require("node:crypto");
async function asegurarQueAdministraLaEmpresa(permisos, organizationId, user, clientId) {
    if (user.role !== 'client')
        return;
    const administra = await permisos.can(organizationId, user.id, user.role, 'users', 'manage', clientId);
    if (!administra)
        throw new common_1.ForbiddenException('Los datos legales de la empresa los mantiene quien la administra. Pídeselo a esa persona.');
}
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
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CompanyLegalDto.prototype, "changeSummary", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CompanyLegalDto.prototype, "publish", void 0);
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
async function leerHistorialLegal(db, organizationId, clientId) {
    const [versions, acceptances, activations] = await Promise.all([
        db.query('SELECT id, document_type AS documentType, version_number AS versionNumber, status, content, content_hash AS contentHash, change_summary AS changeSummary, created_by AS actorId, created_at AS createdAt, effective_from AS effectiveFrom FROM legal_document_versions WHERE organization_id = ? AND client_id = ? ORDER BY created_at DESC LIMIT 100', [organizationId, clientId]),
        db.query('SELECT id, document_type AS documentType, document_version AS documentVersion, actor_id AS actorId, actor_name AS actorName, accepted_at AS acceptedAt FROM legal_acceptance_events WHERE organization_id = ? AND client_id = ? ORDER BY accepted_at DESC LIMIT 50', [organizationId, clientId]),
        db.query('SELECT id, action, actor_id AS actorId, reason, created_at AS createdAt FROM legal_activation_events WHERE organization_id = ? AND client_id = ? ORDER BY created_at DESC LIMIT 50', [organizationId, clientId]),
    ]);
    return { versions, acceptances, activations };
}
const hashDe = (content) => (0, node_crypto_1.createHash)('sha256').update(JSON.stringify(content)).digest('hex');
async function guardarDatosLegales(db, audit, organizationId, clientId, dto, actorId, actorNameOrContext) {
    const context = typeof actorNameOrContext === 'object'
        ? actorNameOrContext ?? {}
        : { actorName: actorNameOrContext };
    const limpio = (valor) => (typeof valor === 'string' && valor.trim() ? valor.trim() : null);
    const ejecutar = async (manager, transaccional) => {
        const antes = await leerDatosLegales(manager, organizationId, clientId);
        const valor = (campo, actual, normalizar = true) => dto[campo] === undefined
            ? actual
            : normalizar ? limpio(dto[campo]) : dto[campo];
        const despues = {
            legalName: valor('legalName', antes.legalName), taxId: valor('taxId', antes.taxId), privacyEmail: valor('privacyEmail', antes.privacyEmail),
            privacyUrl: valor('privacyUrl', antes.privacyUrl), termsUrl: valor('termsUrl', antes.termsUrl),
            legalMode: dto.legalMode === undefined ? antes.legalMode : dto.legalMode === 'texto' ? 'texto' : 'enlace',
            privacyText: valor('privacyText', antes.privacyText), termsText: valor('termsText', antes.termsText),
        };
        const publicar = dto.publish !== false;
        if (publicar)
            await manager.query('UPDATE clients SET legal_name = ?, tax_id = ?, privacy_email = ?, privacy_url = ?, terms_url = ?, legal_mode = ?, privacy_text = ?, terms_text = ? WHERE id = ? AND organization_id = ?', [despues.legalName, despues.taxId, despues.privacyEmail, despues.privacyUrl, despues.termsUrl, despues.legalMode, despues.privacyText, despues.termsText, clientId, organizationId]);
        if (transaccional) {
            const documentos = [
                { type: 'identity', before: { legalName: antes.legalName, taxId: antes.taxId, privacyEmail: antes.privacyEmail }, after: { legalName: despues.legalName, taxId: despues.taxId, privacyEmail: despues.privacyEmail } },
                { type: 'privacy', before: { mode: antes.legalMode, url: antes.privacyUrl, text: antes.privacyText }, after: { mode: despues.legalMode, url: despues.privacyUrl, text: despues.privacyText } },
                { type: 'terms', before: { mode: antes.legalMode, url: antes.termsUrl, text: antes.termsText }, after: { mode: despues.legalMode, url: despues.termsUrl, text: despues.termsText } },
            ];
            for (const documento of documentos) {
                if (hashDe(documento.before) === hashDe(documento.after))
                    continue;
                const versiones = await manager.query('SELECT COALESCE(MAX(version_number), 0) AS version FROM legal_document_versions WHERE organization_id = ? AND client_id = ? AND document_type = ?', [organizationId, clientId, documento.type]);
                const version = Number(versiones[0]?.version ?? 0) + 1;
                if (publicar)
                    await manager.query("UPDATE legal_document_versions SET status = 'replaced' WHERE organization_id = ? AND client_id = ? AND document_type = ? AND status = 'published'", [organizationId, clientId, documento.type]);
                await manager.query('INSERT INTO legal_document_versions (id, organization_id, client_id, document_type, version_number, status, content, content_hash, change_summary, created_by, created_at, effective_from) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [(0, node_crypto_1.randomUUID)(), organizationId, clientId, documento.type, version, publicar ? 'published' : 'draft', JSON.stringify(documento.after), hashDe(documento.after), limpio(dto.changeSummary), actorId, new Date(), new Date()]);
            }
        }
        const auditParams = { organizationId, actorId, entityType: 'ClientLegalData', entityId: clientId, action: publicar ? 'published' : 'draft_saved', before: antes, after: despues, reason: limpio(dto.changeSummary) ?? undefined, ipAddress: context.ipAddress ?? undefined };
        if (transaccional)
            await audit.log(auditParams, manager);
        else
            await audit.log(auditParams);
        if (publicar && dto.aceptaEncargo === true && !antes.encargo.vigente) {
            const ahora = new Date();
            await manager.query('UPDATE clients SET encargo_version = ?, encargo_accepted_at = ?, encargo_accepted_by = ?, encargo_accepted_name = ? WHERE id = ? AND organization_id = ?', [shared_1.VERSION_DOCUMENTOS_LEGALES, ahora, actorId, context.actorName?.slice(0, 180) ?? null, clientId, organizationId]);
            if (transaccional)
                await manager.query('INSERT INTO legal_acceptance_events (id, organization_id, client_id, document_type, document_version, document_hash, actor_id, actor_name, ip_address, user_agent, accepted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [(0, node_crypto_1.randomUUID)(), organizationId, clientId, 'data_processing_agreement', shared_1.VERSION_DOCUMENTOS_LEGALES, hashDe({ version: shared_1.VERSION_DOCUMENTOS_LEGALES }), actorId, context.actorName?.slice(0, 180) ?? null, context.ipAddress ?? null, context.userAgent?.slice(0, 500) ?? null, ahora]);
            const acceptanceAudit = { organizationId, actorId, entityType: 'ClientDataProcessingAgreement', entityId: clientId, action: 'accepted', after: { version: shared_1.VERSION_DOCUMENTOS_LEGALES }, ipAddress: context.ipAddress ?? undefined };
            if (transaccional)
                await audit.log(acceptanceAudit, manager);
            else
                await audit.log(acceptanceAudit);
        }
        return leerDatosLegales(manager, organizationId, clientId);
    };
    if (typeof db.transaction !== 'function')
        return ejecutar(db, false);
    return db.transaction((manager) => ejecutar(manager, true));
}
function empresaDelPortal(clientId) {
    if (!clientId)
        throw new common_1.ForbiddenException('La cuenta no pertenece a una empresa');
    return clientId;
}
async function empresaDeLosDatosLegales(alcance, organizationId, user, pedida) {
    const declarada = pedida?.trim();
    if (declarada) {
        await alcance.assertClient(organizationId, user, declarada);
        return declarada;
    }
    if (user.role === 'client')
        return empresaDelPortal(user.clientId);
    throw new common_1.BadRequestException('Indica la empresa');
}
