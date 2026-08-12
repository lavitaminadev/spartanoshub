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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const brand_1 = require("../../shared/brand");
const common_1 = require("@nestjs/common");
const nodemailer_1 = __importDefault(require("nodemailer"));
function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[character]);
}
function validRecipient(value) {
    return value.length <= 320 && !/[\r\n]/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
let EmailService = EmailService_1 = class EmailService {
    constructor() {
        this.logger = new common_1.Logger(EmailService_1.name);
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
    async send(to, subject, html) {
        const recipient = to.trim().toLowerCase();
        if (!validRecipient(recipient)) {
            this.logger.warn('Email skipped because the recipient is invalid');
            return false;
        }
        if (!this.transporter) {
            this.logger.warn('Email not sent because SMTP_ENABLED is false');
            return false;
        }
        try {
            const result = await this.transporter.sendMail({
                from: this.from,
                to: recipient,
                replyTo: this.replyTo,
                subject: subject.replace(/[\r\n]+/g, ' ').trim().slice(0, 255),
                html,
            });
            const accepted = Array.isArray(result.accepted) ? result.accepted.length : 0;
            if (!accepted)
                this.logger.warn(`SMTP rejected message ${result.messageId}`);
            return accepted > 0;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown SMTP error';
            this.logger.error(`SMTP delivery failed: ${message}`);
            return false;
        }
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
    async sendTemporaryPassword(name, recipient, password, loginUrl) {
        return this.send(recipient, `Acceso temporal a ${brand_1.BRAND.name}`, `<h2>Hola ${escapeHtml(name)}</h2>
       <p>Un administrador generó un acceso temporal para tu cuenta.</p>
       <p>Contraseña temporal: <strong>${escapeHtml(password)}</strong></p>
       <p><a href="${escapeHtml(loginUrl)}">Ingresar a ${brand_1.BRAND.name}</a></p>
       <p>El sistema solicitará crear una contraseña personal al iniciar sesión.</p>`);
    }
    async sendPasswordReset(name, recipient, resetUrl) {
        return this.send(recipient, `Recupera tu acceso a ${brand_1.BRAND.name}`, `<h2>Hola ${escapeHtml(name)}</h2>
       <p>Recibimos una solicitud para restablecer tu contraseña.</p>
       <p><a href="${escapeHtml(resetUrl)}">Crear una nueva contraseña</a></p>
       <p>Este enlace vence en 30 minutos. Si no solicitaste el cambio, ignora este mensaje.</p>`);
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EmailService);
