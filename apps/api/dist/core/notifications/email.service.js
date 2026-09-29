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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const brand_1 = require("../../shared/brand");
const common_1 = require("@nestjs/common");
const parameter_resolver_service_1 = require("../parameters/parameter-resolver.service");
const plantilla_resuelta_1 = require("../parameters/plantilla-resuelta");
const plantilla_de_correo_1 = require("./plantilla-de-correo");
const nodemailer_1 = __importDefault(require("nodemailer"));
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const registro_de_correo_entity_1 = require("./registro-de-correo.entity");
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
}
function validRecipient(value) {
    return value.length <= 320 && !/[\r\n]/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
let EmailService = EmailService_1 = class EmailService {
    constructor(parametros, registro) {
        this.parametros = parametros;
        this.registro = registro;
        this.logger = new common_1.Logger(EmailService_1.name);
        this.ultimaLimpieza = 0;
        const enabled = process.env.SMTP_ENABLED === 'true';
        this.from = process.env.SMTP_FROM?.trim() || '';
        this.replyTo = process.env.SMTP_REPLY_TO?.trim() || undefined;
        if (!enabled)
            return;
        const port = Number(process.env.SMTP_PORT || 465);
        const secure = process.env.SMTP_SECURE === 'true' || port === 465;
        this.transporter = nodemailer_1.default.createTransport({
            host: process.env.SMTP_HOST,
            port,
            secure,
            requireTLS: !secure,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASSWORD,
            },
            tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
            connectionTimeout: 10_000,
            greetingTimeout: 10_000,
            socketTimeout: 20_000,
        });
    }
    estado() {
        const faltan = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM'].filter((clave) => !process.env[clave]?.trim());
        return {
            habilitado: Boolean(this.transporter) && faltan.length === 0,
            remitente: this.from || null,
            servidor: process.env.SMTP_HOST?.trim() || null,
            puerto: process.env.SMTP_HOST ? Number(process.env.SMTP_PORT || 465) : null,
            respuestasA: this.replyTo ?? null,
            faltan: process.env.SMTP_ENABLED === 'true' ? faltan : ['SMTP_ENABLED=true', ...faltan],
        };
    }
    async send(to, subject, html, options) {
        const recipient = to.trim().toLowerCase();
        const asunto = subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 255);
        if (!validRecipient(recipient)) {
            this.logger.warn('Email skipped because the recipient is invalid');
            this.anotar(recipient, asunto, 'omitido', 'Dirección de correo no válida');
            return false;
        }
        if (!this.transporter) {
            this.logger.warn('Email not sent because SMTP_ENABLED is false');
            this.anotar(recipient, asunto, 'omitido', 'El correo de salida está apagado (SMTP_ENABLED)');
            return false;
        }
        try {
            const result = await this.transporter.sendMail({
                from: this.from,
                to: recipient,
                replyTo: options?.replyTo ?? this.replyTo,
                subject: asunto,
                html,
                attachments: options?.attachments,
            });
            const accepted = Array.isArray(result.accepted) ? result.accepted.length : 0;
            if (!accepted)
                this.logger.warn(`SMTP rejected message ${result.messageId}`);
            this.anotar(recipient, asunto, accepted > 0 ? 'enviado' : 'rechazado', accepted > 0 ? null : 'El servidor de correo no lo aceptó');
            return accepted > 0;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown SMTP error';
            this.logger.error(`SMTP delivery failed: ${message}`);
            this.anotar(recipient, asunto, 'fallido', message);
            return false;
        }
    }
    anotar(destinatario, asunto, resultado, motivo) {
        if (!this.registro)
            return;
        const registro = this.registro;
        void registro
            .insert({ destinatario: destinatario.slice(0, 320) || '(vacío)', asunto: asunto || '(sin asunto)', resultado, motivo: motivo?.slice(0, 255) ?? null })
            .catch((error) => this.logger.warn(`No se pudo anotar el correo: ${error instanceof Error ? error.message : error}`));
        if (Date.now() - this.ultimaLimpieza < 60 * 60_000)
            return;
        this.ultimaLimpieza = Date.now();
        void registro
            .delete({ createdAt: (0, typeorm_2.LessThan)(new Date(Date.now() - 90 * 24 * 60 * 60_000)) })
            .catch(() => undefined);
    }
    async sendCollectionEmail(clientName, clientEmail, invoiceNumber, amount, dueDate) {
        const safeName = escapeHtml(clientName);
        const safeNumber = escapeHtml(invoiceNumber);
        const safeDate = escapeHtml(dueDate);
        return this.send(clientEmail, `Recordatorio de pago - Factura ${invoiceNumber}`, `<h2>Estimado(a) ${safeName}</h2>
       <p>Le recordamos que la factura <strong>${safeNumber}</strong> por <strong>$${amount.toLocaleString('es-CL')}</strong>
       con vencimiento el <strong>${safeDate}</strong> se encuentra pendiente de pago.</p>
       <p>Por favor, realice el pago a la brevedad para evitar interrupciones en el servicio.</p>
       <p>Saludos,<br>${brand_1.BRAND.teamSignature}</p>`);
    }
    async sendUdBudgetAlert(clientName, clientEmail, used, total) {
        const pct = total > 0 ? Math.round((used / total) * 100) : 100;
        const safeName = escapeHtml(clientName);
        return this.send(clientEmail, `Alerta de presupuesto UD - ${clientName}`, `<h2>Estimado(a) ${safeName}</h2>
       <p>Ha utilizado el <strong>${pct}%</strong> de su presupuesto de diseño mensual
       (${used.toLocaleString('es-CL')} de ${total.toLocaleString('es-CL')} UD contratadas).</p>
       ${pct >= 100 ? '<p><strong>Su presupuesto se ha agotado.</strong> Las nuevas solicitudes quedarán en espera hasta el próximo ciclo.</p>' : '<p>Le recomendamos planificar las solicitudes restantes del mes.</p>'}
       <p>Saludos,<br>${brand_1.BRAND.teamSignature}</p>`);
    }
    async sendPieceStuckAlert(designerEmail, pieceTitle, hoursStuck) {
        const safeTitle = escapeHtml(pieceTitle);
        return this.send(designerEmail, `Alerta: Pieza estancada - ${pieceTitle}`, `<h2>Alerta de producción</h2>
       <p>La pieza <strong>${safeTitle}</strong> lleva <strong>${Math.round(hoursStuck)} horas</strong> sin movimiento.</p>
       <p>Por favor, revise y actualice su estado.</p>`);
    }
    async sendTemporaryPassword(name, recipient, password, loginUrl, organizationId) {
        const plantilla = await this.plantillaDeAcceso('email.access_temporary_password', organizationId, {
            asunto: `Acceso temporal a ${brand_1.BRAND.name}`,
            cuerpo: 'Hola {{nombre}}:\n\nUn administrador generó un acceso temporal para tu cuenta.\n\nTu usuario: {{usuario}}\nContraseña temporal: {{clave}}\n\nEntra en {{enlace}}. El sistema te pedirá crear una contraseña personal al iniciar sesión.',
        }, ['clave', 'enlace']);
        const cuerpo = plantilla.cuerpo.includes('{{usuario}}') ? plantilla.cuerpo : `${plantilla.cuerpo}\n\nTu usuario: {{usuario}}`;
        const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(plantilla.asunto, cuerpo, { nombre: name, usuario: recipient, clave: password, enlace: loginUrl }, { texto: `Ingresar a ${brand_1.BRAND.name}`, url: loginUrl });
        return this.send(recipient, subject, html);
    }
    async sendPasswordReset(name, recipient, resetUrl, organizationId) {
        const plantilla = await this.plantillaDeAcceso('email.access_password_reset', organizationId, {
            asunto: `Recupera tu acceso a ${brand_1.BRAND.name}`,
            cuerpo: 'Hola {{nombre}}:\n\nRecibimos una solicitud para restablecer tu contraseña. Para crear una nueva entra en {{enlace}}\n\nEste enlace vence en 30 minutos. Si no lo pediste, ignora este mensaje.',
        }, ['enlace']);
        const { subject, html } = (0, plantilla_de_correo_1.componerCorreo)(plantilla.asunto, plantilla.cuerpo, { nombre: name, enlace: resetUrl }, { texto: 'Crear una nueva contraseña', url: resetUrl });
        return this.send(recipient, subject, html);
    }
    async plantillaDeAcceso(prefijo, organizationId, respaldo, obligatorias) {
        if (!this.parametros)
            return { ...respaldo, encendido: true };
        try {
            return await (0, plantilla_resuelta_1.leerPlantilla)(this.parametros, prefijo, { organizationId: organizationId ?? null }, respaldo, { obligatorias, encendidoPorDefecto: null });
        }
        catch {
            return { ...respaldo, encendido: true };
        }
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Optional)()),
    __param(1, (0, common_1.Optional)()),
    __param(1, (0, typeorm_1.InjectRepository)(registro_de_correo_entity_1.RegistroDeCorreo)),
    __metadata("design:paramtypes", [parameter_resolver_service_1.ParameterResolver,
        typeorm_2.Repository])
], EmailService);
