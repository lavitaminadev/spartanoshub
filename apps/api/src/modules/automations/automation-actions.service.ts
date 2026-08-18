import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationService } from '../../core/notifications/notification.service';
import { EmailService } from '../../core/notifications/email.service';
import { ProcessCommentsService } from '../collaboration/process-comments.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { ContractsService } from '../contracts/contracts.service';
import { CommentSubject, CommentVisibility } from '../collaboration/process-comment.entity';
import { Opportunity } from '../crm/opportunities/opportunity.entity';
import { Lead } from '../crm/leads/lead.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../organizations/user-role.enum';

/** Lo que una acción recibe para hacer su trabajo. */
export interface ActionContext {
  organizationId: string;
  entityType: string;
  entityId: string;
  /** Identidad declarada de la automatización. Toda escritura queda atribuida a ella. */
  actingUserId: string;
  context: Record<string, unknown>;
}

/**
 * Efectos que una automatización puede producir.
 *
 * Cada acción se apoya en el servicio que ya resuelve ese efecto en el resto del sistema, en
 * vez de reimplementarlo: una notificación creada por una automatización tiene que ser
 * indistinguible de una creada por una pantalla, o terminaría habiendo dos formatos de
 * notificación que divergen.
 *
 * Ninguna acción habla con un tercero en línea. Lo que sale a la red lo hace por su propia
 * bandeja de salida, para que una caída ajena no deje la ejecución colgada.
 */
@Injectable()
export class AutomationActionsService {
  private readonly logger = new Logger(AutomationActionsService.name);

  constructor(
    private readonly notifications: NotificationService,
    private readonly emails: EmailService,
    private readonly comments: ProcessCommentsService,
    private readonly webhooks: WebhookDeliveryService,
    private readonly contracts: ContractsService,
    @InjectRepository(Opportunity) private readonly opportunities: Repository<Opportunity>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  /**
   * Ejecuta una acción del catálogo.
   *
   * @returns Datos que se suman al contexto para los nodos siguientes.
   * @throws Si la acción no existe o su configuración es inválida. El ejecutor lo reintenta.
   */
  async execute(key: string, config: Record<string, unknown>, ctx: ActionContext): Promise<Record<string, unknown> | null> {
    switch (key) {
      case 'notify_user': return this.notifyUser(config, ctx);
      case 'notify_assignee': return this.notifyAssignee(config, ctx);
      case 'send_email': return this.sendEmail(config, ctx);
      case 'assign_user': return this.assignUser(config, ctx);
      case 'add_comment': return this.addComment(config, ctx);
      case 'send_webhook': return this.sendWebhook(config, ctx);
      case 'create_contract': return this.createContract(config, ctx);
      default:
        throw new BadRequestException(`La acción "${key}" no está implementada`);
    }
  }

  private async notifyUser(config: Record<string, unknown>, ctx: ActionContext): Promise<Record<string, unknown>> {
    const userId = this.text(config.userId);
    if (!userId) throw new BadRequestException('La notificación necesita un destinatario');
    await this.notifications.notifyUser(
      ctx.organizationId, userId, 'automation',
      this.render(this.text(config.title) ?? 'Aviso', ctx.context),
      this.render(this.text(config.message) ?? '', ctx.context),
      { entityType: ctx.entityType, entityId: ctx.entityId },
    );
    return { notifiedUserId: userId };
  }

  /**
   * Notifica a quien tenga asignado el registro.
   *
   * Si no hay responsable no se falla: una automatización que avisa al responsable de un
   * trato sin dueño no tiene nada que hacer, y tratarlo como error la haría reintentar cinco
   * veces contra una situación que es normal.
   */
  private async notifyAssignee(config: Record<string, unknown>, ctx: ActionContext): Promise<Record<string, unknown>> {
    const assignee = this.text(ctx.context.assignedTo);
    if (!assignee) {
      this.logger.log(`Sin responsable en ${ctx.entityType} ${ctx.entityId}: no hay a quién notificar`);
      return { skipped: 'sin responsable' };
    }
    await this.notifications.notifyUser(
      ctx.organizationId, assignee, 'automation',
      this.render(this.text(config.title) ?? 'Aviso', ctx.context),
      this.render(this.text(config.message) ?? '', ctx.context),
      { entityType: ctx.entityType, entityId: ctx.entityId },
    );
    return { notifiedUserId: assignee };
  }

  private async sendEmail(config: Record<string, unknown>, ctx: ActionContext): Promise<Record<string, unknown>> {
    const to = this.render(this.text(config.to) ?? '', ctx.context);
    if (!to.includes('@')) throw new BadRequestException('El correo necesita un destinatario válido');
    const enviado = await this.emails.send(
      to,
      this.render(this.text(config.subject) ?? '', ctx.context),
      this.escapeHtml(this.render(this.text(config.body) ?? '', ctx.context)),
    );
    return { emailSent: enviado, emailTo: to };
  }

  /**
   * Asigna un responsable al registro.
   *
   * Comprueba que la persona exista y esté activa en la organización antes de escribir:
   * asignar a alguien dado de baja deja el trabajo en manos de nadie y no avisa.
   */
  private async assignUser(config: Record<string, unknown>, ctx: ActionContext): Promise<Record<string, unknown>> {
    const userId = this.text(config.userId);
    if (!userId) throw new BadRequestException('La asignación necesita una persona');

    const user = await this.users.findOne({
      where: { id: userId, organizationId: ctx.organizationId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new BadRequestException('La persona indicada no está activa en la organización');

    if (ctx.entityType === 'opportunity') {
      await this.opportunities.update({ id: ctx.entityId, organizationId: ctx.organizationId }, { assignedTo: userId });
    } else if (ctx.entityType === 'lead') {
      await this.leads.update({ id: ctx.entityId, organizationId: ctx.organizationId }, { assignedTo: userId });
    } else {
      throw new BadRequestException(`No se puede asignar responsable a un registro de tipo "${ctx.entityType}"`);
    }
    return { assignedTo: userId };
  }

  /**
   * Deja una nota en el hilo del registro.
   *
   * Siempre interna: una automatización no tiene criterio para decidir que algo debe verlo el
   * cliente, y equivocarse en esa dirección es una filtración.
   */
  private async addComment(config: Record<string, unknown>, ctx: ActionContext): Promise<Record<string, unknown>> {
    const subject = ctx.entityType === 'opportunity' ? CommentSubject.OPPORTUNITY
      : ctx.entityType === 'lead' ? CommentSubject.LEAD
        : null;
    if (!subject) throw new BadRequestException(`No hay hilo para un registro de tipo "${ctx.entityType}"`);

    const comment = await this.comments.add(
      ctx.organizationId, subject, ctx.entityId,
      this.render(this.text(config.body) ?? '', ctx.context),
      CommentVisibility.INTERNAL,
      { id: ctx.actingUserId, role: UserRole.ADMIN, name: 'Automatización' },
    );
    return { commentId: comment.id };
  }

  /**
   * Abre el contrato del trato ganado.
   *
   * Es el eslabón que faltaba entre lo comercial y lo operativo: hasta ahora ganar un trato no
   * creaba nada y alguien tenía que ir a abrir el contrato a mano en otra pantalla.
   *
   * **Se omite si el trato no tiene cliente**, en vez de fallar. Un trato se gana antes de que
   * exista la ficha del cliente —la crea «Convertir en cliente» desde el prospecto—, así que
   * llegar sin cliente es lo normal en la mitad de los casos y no un error que merezca cinco
   * reintentos. Cuando el cliente ya existe, el contrato queda abierto solo.
   *
   * Nace en `paused` y no en `activo`: un contrato define lo que se factura, y esa cifra la
   * confirma una persona. Activarlo automáticamente pondría a cobrar un monto que nadie revisó.
   */
  private async createContract(config: Record<string, unknown>, ctx: ActionContext): Promise<Record<string, unknown>> {
    if (ctx.entityType !== 'opportunity') {
      throw new BadRequestException('Solo un trato puede abrir un contrato');
    }

    const opportunity = await this.opportunities.findOne({
      where: { id: ctx.entityId, organizationId: ctx.organizationId },
    });
    if (!opportunity) throw new BadRequestException('El trato ya no existe');

    if (!opportunity.clientId) {
      this.logger.log(`Trato ${opportunity.id} sin cliente: el contrato se abrirá cuando exista la ficha`);
      return { skipped: 'el trato aún no tiene cliente' };
    }

    const contract = await this.contracts.create({
      clientId: opportunity.clientId,
      name: this.render(this.text(config.name) ?? opportunity.name, ctx.context),
      startDate: new Date().toISOString().slice(0, 10),
      monthlyPrice: opportunity.amount ? Number(opportunity.amount) : undefined,
      status: 'paused',
    }, ctx.organizationId);

    return { contractId: contract.id, contractStatus: contract.status };
  }

  /**
   * Deja un webhook en la bandeja de salida.
   *
   * **No llama a nadie desde acá.** Un destinatario caído o lento retendría la ejecución
   * durante su tiempo de espera y, con ella, las demás automatizaciones de la misma tanda. Es
   * la misma razón por la que Meta y Google tienen la suya.
   *
   * El cuerpo lleva siempre el registro que disparó el flujo, para que quien recibe sepa de
   * qué se le está hablando sin tener que consultarnos de vuelta.
   */
  private async sendWebhook(config: Record<string, unknown>, ctx: ActionContext): Promise<Record<string, unknown>> {
    const url = this.text(config.url);
    if (!url) throw new BadRequestException('El webhook necesita una dirección');

    const delivery = await this.webhooks.enqueue(ctx.organizationId, url, {
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      context: ctx.context,
      sentAt: new Date().toISOString(),
    });
    return { webhookDeliveryId: delivery.id };
  }

  /**
   * Sustituye `{{campo}}` por su valor del contexto.
   *
   * Deliberadamente no es un lenguaje de plantillas: solo reemplaza claves planas. Cualquier
   * cosa más expresiva acaba siendo código ejecutable dentro de un campo de texto, que es
   * justo lo que no se quiere en una automatización configurable desde una pantalla.
   */
  private render(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
      const value = context[key];
      return value === null || value === undefined ? '' : String(value);
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!
    ));
  }

  private text(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  }
}
