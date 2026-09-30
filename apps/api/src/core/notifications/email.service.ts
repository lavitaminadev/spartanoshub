import { BRAND } from '../../shared/brand';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ParameterResolver } from '../parameters/parameter-resolver.service';
import { leerPlantilla } from '../parameters/plantilla-resuelta';
import { componerCorreo, textoDesdeHtml } from './plantilla-de-correo';
import nodemailer, { SendMailOptions, Transporter } from 'nodemailer';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RegistroDeCorreo } from './registro-de-correo.entity';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

function validRecipient(value: string): boolean {
  return value.length <= 320 && !/[\r\n]/.test(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter?: Transporter;
  private readonly from: string;
  private readonly replyTo?: string;

  // Opcional: las pruebas y los usos sin base de datos siguen construyéndolo sin argumentos, y
  // entonces los correos de acceso usan su texto de fábrica.
  constructor(
    @Optional() private readonly parametros?: ParameterResolver,
    @Optional() @InjectRepository(RegistroDeCorreo) private readonly registro?: Repository<RegistroDeCorreo>,
  ) {
    const enabled = process.env.SMTP_ENABLED === 'true';
    this.from = process.env.SMTP_FROM?.trim() || '';
    this.replyTo = process.env.SMTP_REPLY_TO?.trim() || undefined;
    if (!enabled) return;

    const port = Number(process.env.SMTP_PORT || 465);
    const secure = process.env.SMTP_SECURE === 'true' || port === 465;
    this.transporter = nodemailer.createTransport({
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

  /**
   * @param options - `replyTo` sustituye el buzon global de respuesta. Lo usa quien sabe a
   *   quien le toca contestar: la confirmacion de una reserva la responde el local, no la
   *   agencia que le presta el servidor de correo.
   */
  /**
   * Estado del envío para mostrarlo en pantalla, sin contraseña ni usuario completo.
   * Los datos del servidor se configuran en el entorno del servidor, no desde la aplicación.
   */
  estado(): { habilitado: boolean; remitente: string | null; servidor: string | null; puerto: number | null; respuestasA: string | null; faltan: string[] } {
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

  async send(to: string, subject: string, html: string, options?: Pick<SendMailOptions, 'attachments' | 'replyTo'> & {
    /** La carta en texto. Sin ella se deriva del HTML, que es lo que hace el caso corriente. */
    text?: string;
    /** Dirección de baja del correo comercial. Sólo en los que la llevan. */
    bajaUrl?: string;
  }): Promise<boolean> {
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
        /*
         * La misma carta en texto, siempre.
         *
         * Mandar sólo HTML es de las causas más comunes de caer en spam o en «Promociones», y es
         * lo que hacíamos en todos los correos. Va acá porque es el único punto por el que pasan
         * todos: armarla en cada sitio que compone un correo habría dejado alguno fuera.
         */
        text: options?.text ?? textoDesdeHtml(html),
        attachments: options?.attachments,
        /*
         * Cabecera de baja, cuando el correo la lleva.
         *
         * Gmail y Yahoo la exigen en el correo comercial desde 2024, y muestran el botón «Anular
         * suscripción» junto al remitente: quien la usa se da de baja en vez de marcar spam, que
         * es lo que daña la reputación del servidor y arrastra al resto de los correos.
         */
        list: options?.bajaUrl ? { unsubscribe: { url: options.bajaUrl, comment: 'Dejar de recibir estos correos' } } : undefined,
      });
      const accepted = Array.isArray(result.accepted) ? result.accepted.length : 0;
      if (!accepted) this.logger.warn(`SMTP rejected message ${result.messageId}`);
      this.anotar(recipient, asunto, accepted > 0 ? 'enviado' : 'rechazado', accepted > 0 ? null : 'El servidor de correo no lo aceptó');
      return accepted > 0;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown SMTP error';
      this.logger.error(`SMTP delivery failed: ${message}`);
      this.anotar(recipient, asunto, 'fallido', message);
      return false;
    }
  }

  private ultimaLimpieza = 0;

  /**
   * Deja constancia del intento, sin el cuerpo del correo.
   *
   * No espera ni lanza: anotar nunca puede demorar ni impedir un envío. De paso, como mucho una
   * vez por hora, borra lo que tenga más de 90 días.
   */
  private anotar(destinatario: string, asunto: string, resultado: RegistroDeCorreo['resultado'], motivo: string | null): void {
    if (!this.registro) return;
    const registro = this.registro;
    void registro
      .insert({ destinatario: destinatario.slice(0, 320) || '(vacío)', asunto: asunto || '(sin asunto)', resultado, motivo: motivo?.slice(0, 255) ?? null })
      .catch((error: unknown) => this.logger.warn(`No se pudo anotar el correo: ${error instanceof Error ? error.message : error}`));
    if (Date.now() - this.ultimaLimpieza < 60 * 60_000) return;
    this.ultimaLimpieza = Date.now();
    void registro
      .delete({ createdAt: LessThan(new Date(Date.now() - 90 * 24 * 60 * 60_000)) })
      .catch(() => undefined);
  }

  async sendCollectionEmail(clientName: string, clientEmail: string, invoiceNumber: string, amount: number, dueDate: string): Promise<boolean> {
    const safeName = escapeHtml(clientName);
    const safeNumber = escapeHtml(invoiceNumber);
    const safeDate = escapeHtml(dueDate);
    return this.send(
      clientEmail,
      `Recordatorio de pago - Factura ${invoiceNumber}`,
      `<h2>Estimado(a) ${safeName}</h2>
       <p>Le recordamos que la factura <strong>${safeNumber}</strong> por <strong>$${amount.toLocaleString('es-CL')}</strong>
       con vencimiento el <strong>${safeDate}</strong> se encuentra pendiente de pago.</p>
       <p>Por favor, realice el pago a la brevedad para evitar interrupciones en el servicio.</p>
       <p>Saludos,<br>${BRAND.teamSignature}</p>`,
    );
  }

  async sendUdBudgetAlert(clientName: string, clientEmail: string, used: number, total: number): Promise<boolean> {
    const pct = total > 0 ? Math.round((used / total) * 100) : 100;
    const safeName = escapeHtml(clientName);
    return this.send(
      clientEmail,
      `Alerta de presupuesto UD - ${clientName}`,
      `<h2>Estimado(a) ${safeName}</h2>
       <p>Ha utilizado el <strong>${pct}%</strong> de su presupuesto de diseño mensual
       (${used.toLocaleString('es-CL')} de ${total.toLocaleString('es-CL')} UD contratadas).</p>
       ${pct >= 100 ? '<p><strong>Su presupuesto se ha agotado.</strong> Las nuevas solicitudes quedarán en espera hasta el próximo ciclo.</p>' : '<p>Le recomendamos planificar las solicitudes restantes del mes.</p>'}
       <p>Saludos,<br>${BRAND.teamSignature}</p>`,
    );
  }

  async sendPieceStuckAlert(designerEmail: string, pieceTitle: string, hoursStuck: number): Promise<boolean> {
    const safeTitle = escapeHtml(pieceTitle);
    return this.send(
      designerEmail,
      `Alerta: Pieza estancada - ${pieceTitle}`,
      `<h2>Alerta de producción</h2>
       <p>La pieza <strong>${safeTitle}</strong> lleva <strong>${Math.round(hoursStuck)} horas</strong> sin movimiento.</p>
       <p>Por favor, revise y actualice su estado.</p>`,
    );
  }

  /**
   * Contraseña temporal para una cuenta nueva o reseteada.
   *
   * El texto sale de su plantilla, editable en Correos. No tiene interruptor: sin él la persona no
   * entra. Y si la plantilla guardada perdió `{{clave}}` o `{{enlace}}`, se usa la de fábrica.
   */
  async sendTemporaryPassword(name: string, recipient: string, password: string, loginUrl: string, organizationId?: string | null): Promise<boolean> {
    const plantilla = await this.plantillaDeAcceso('email.access_temporary_password', organizationId, {
      asunto: `Acceso temporal a ${BRAND.name}`,
      cuerpo: 'Hola {{nombre}}:\n\nUn administrador generó un acceso temporal para tu cuenta.\n\nTu usuario: {{usuario}}\nContraseña temporal: {{clave}}\n\nEntra en {{enlace}}. El sistema te pedirá crear una contraseña personal al iniciar sesión.',
    }, ['clave', 'enlace']);
    // Con qué entrar va siempre: un texto propio escrito antes de existir {{usuario}} lo recibe al final.
    const cuerpo = plantilla.cuerpo.includes('{{usuario}}') ? plantilla.cuerpo : `${plantilla.cuerpo}\n\nTu usuario: {{usuario}}`;
    const { subject, html } = componerCorreo(
      plantilla.asunto,
      cuerpo,
      { nombre: name, usuario: recipient, clave: password, enlace: loginUrl },
      { texto: `Ingresar a ${BRAND.name}`, url: loginUrl },
    );
    return this.send(recipient, subject, html);
  }

  /** Enlace para recuperar el acceso. Misma regla: sin interruptor, y `{{enlace}}` obligatorio. */
  async sendPasswordReset(name: string, recipient: string, resetUrl: string, organizationId?: string | null): Promise<boolean> {
    const plantilla = await this.plantillaDeAcceso('email.access_password_reset', organizationId, {
      asunto: `Recupera tu acceso a ${BRAND.name}`,
      cuerpo: 'Hola {{nombre}}:\n\nRecibimos una solicitud para restablecer tu contraseña. Para crear una nueva entra en {{enlace}}\n\nEste enlace vence en 30 minutos. Si no lo pediste, ignora este mensaje.',
    }, ['enlace']);
    const { subject, html } = componerCorreo(
      plantilla.asunto,
      plantilla.cuerpo,
      { nombre: name, enlace: resetUrl },
      { texto: 'Crear una nueva contraseña', url: resetUrl },
    );
    return this.send(recipient, subject, html);
  }

  /**
   * La plantilla de un correo de acceso, o la de fábrica si no se puede leer.
   *
   * Un fallo al leer los parámetros no puede impedir que alguien reciba su acceso: se cae al
   * texto de fábrica, que siempre funciona.
   */
  private async plantillaDeAcceso(prefijo: string, organizationId: string | null | undefined, respaldo: { asunto: string; cuerpo: string }, obligatorias: string[]) {
    if (!this.parametros) return { ...respaldo, encendido: true };
    try {
      return await leerPlantilla(this.parametros, prefijo, { organizationId: organizationId ?? null }, respaldo, { obligatorias, encendidoPorDefecto: null });
    } catch {
      return { ...respaldo, encendido: true };
    }
  }
}
