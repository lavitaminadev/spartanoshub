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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DetalleDeContactoEnAvisosService = exports.ACCION_DETALLE_DE_CONTACTO = exports.TEXTO_DE_DETALLE_DE_CONTACTO = exports.TITULO_DEL_TEXTO_DE_DETALLE_DE_CONTACTO = exports.VERSION_DEL_TEXTO_DE_DETALLE_DE_CONTACTO = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const consent_version_entity_1 = require("../../core/data-protection/consent-version.entity");
const consent_entity_1 = require("../../core/data-protection/consent.entity");
const audit_service_1 = require("../../core/audit/audit.service");
const user_role_enum_1 = require("../organizations/user-role.enum");
exports.VERSION_DEL_TEXTO_DE_DETALLE_DE_CONTACTO = 1;
exports.TITULO_DEL_TEXTO_DE_DETALLE_DE_CONTACTO = `Detalle de contacto en avisos de grupo (v${exports.VERSION_DEL_TEXTO_DE_DETALLE_DE_CONTACTO})`;
exports.TEXTO_DE_DETALLE_DE_CONTACTO = 'Autorizo que el aviso por correo de solicitud de grupo de esta empresa incluya el teléfono y el '
    + 'correo de quien pidió el evento, solo para destinatarios que son cuentas con acceso directo a '
    + 'los datos del comensal. Entiendo que un correo no deja constancia de quién lo leyó, que puede '
    + 'reenviarse y que queda en bandejas externas; que las alergias y las respuestas del formulario '
    + 'no se envían nunca por correo; y que la agencia lo hace como encargada del tratamiento por '
    + 'cuenta de la empresa. Puedo retirar esta autorización en cualquier momento.';
const PUEDEN_ENCENDER = [user_role_enum_1.UserRole.COMMERCIAL_DIRECTOR, user_role_enum_1.UserRole.ADMIN, user_role_enum_1.UserRole.DEV];
exports.ACCION_DETALLE_DE_CONTACTO = 'detalle_contacto_avisos';
let DetalleDeContactoEnAvisosService = class DetalleDeContactoEnAvisosService {
    constructor(textos, consentimientos, audit) {
        this.textos = textos;
        this.consentimientos = consentimientos;
        this.audit = audit;
    }
    async texto(organizationId) {
        let fila = await this.textos.findOne({ where: { organizationId, title: exports.TITULO_DEL_TEXTO_DE_DETALLE_DE_CONTACTO } });
        if (!fila) {
            const ultima = await this.textos.findOne({ where: { organizationId }, order: { version: 'DESC' } });
            fila = await this.textos.save(this.textos.create({
                organizationId,
                version: (ultima?.version ?? 0) + 1,
                title: exports.TITULO_DEL_TEXTO_DE_DETALLE_DE_CONTACTO,
                text: exports.TEXTO_DE_DETALLE_DE_CONTACTO,
                active: false,
            }));
        }
        return { id: fila.id, version: fila.version, titulo: fila.title, texto: fila.text };
    }
    puedeEncender(rol) {
        return PUEDEN_ENCENDER.includes(rol);
    }
    async registrarCambio(ctx) {
        let versionAceptada = null;
        if (ctx.encender) {
            if (!this.puedeEncender(ctx.rol)) {
                throw new common_1.ForbiddenException('Sólo dirección comercial, administración o desarrollo pueden encender el detalle de contacto en los avisos');
            }
            const texto = await this.texto(ctx.organizationId);
            if (!ctx.aceptacion || ctx.aceptacion !== texto.id) {
                throw new common_1.ForbiddenException({
                    message: 'Para encender el detalle de contacto en los avisos hay que aceptar el texto vigente',
                    requiereAceptacion: true,
                });
            }
            versionAceptada = texto.version;
        }
        await this.consentimientos.save(this.consentimientos.create({
            userId: ctx.actorId,
            action: `${exports.ACCION_DETALLE_DE_CONTACTO}:${ctx.clientId}:${ctx.encender ? `aceptado:v${versionAceptada}` : 'retirado'}`,
            granted: ctx.encender,
            ipAddress: ctx.ip ?? null,
        }));
        await this.audit.log({
            organizationId: ctx.organizationId,
            actorId: ctx.actorId,
            entityType: 'Client',
            entityId: ctx.clientId,
            action: ctx.encender ? 'detalle_contacto_avisos_encendido' : 'detalle_contacto_avisos_apagado',
            after: { detalleDeContactoEnAvisos: ctx.encender, versionDelTexto: versionAceptada },
            ipAddress: ctx.ip,
        });
    }
};
exports.DetalleDeContactoEnAvisosService = DetalleDeContactoEnAvisosService;
exports.DetalleDeContactoEnAvisosService = DetalleDeContactoEnAvisosService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(consent_version_entity_1.ConsentVersion)),
    __param(1, (0, typeorm_1.InjectRepository)(consent_entity_1.DataConsent)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        audit_service_1.AuditService])
], DetalleDeContactoEnAvisosService);
