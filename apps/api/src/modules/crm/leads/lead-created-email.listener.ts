import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from '../../../core/notifications/email.service';
import { componerCorreo } from '../../../core/notifications/plantilla-de-correo';
import { ParameterResolver } from '../../../core/parameters/parameter-resolver.service';
import { User } from '../../users/user.entity';
import { Lead } from './lead.entity';

interface LeadCreatedEvent {
  organizationId: string;
  leadId: string;
  clientId: string | null;
}

/**
 * Entrega el aviso de una captura nueva a las personas activas de esa empresa.
 *
 * El vínculo estable es `users.client_id`: no se adivina un dueño por orden de alta ni se usa
 * una dirección global de la agencia. Si una empresa tiene varios usuarios, todos reciben el
 * aviso; cuando no tiene ninguno no se fabrica un destinatario ni se filtra el lead a otra
 * empresa.
 */
@Injectable()
export class LeadCreatedEmailListener {
  private readonly logger = new Logger(LeadCreatedEmailListener.name);

  constructor(
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly parameters: ParameterResolver,
    private readonly email: EmailService,
  ) {}

  @OnEvent('lead.created')
  async handle(event: LeadCreatedEvent): Promise<void> {
    // El aviso es para la empresa dueña del lead. Los prospectos de la propia agencia no tienen
    // un cliente asociado, por lo que no hay un destinatario de cliente que sea correcto.
    if (!event.clientId) return;

    try {
      const enabled = await this.parameters.get(
        'email.new_lead_enabled', event.clientId, null, event.organizationId,
      );
      if (enabled !== true) return;

      const [lead, subjectTemplate, bodyTemplate, recipients] = await Promise.all([
        this.leads.findOne({
          where: { id: event.leadId, organizationId: event.organizationId, clientId: event.clientId },
          select: {
            id: true, name: true, email: true, phone: true, source: true,
            campaignName: true, organizationId: true, clientId: true,
          },
        }),
        this.parameters.get('email.new_lead_subject', event.clientId, null, event.organizationId),
        this.parameters.get('email.new_lead_body', event.clientId, null, event.organizationId),
        this.users.find({
          where: { organizationId: event.organizationId, clientId: event.clientId, isActive: true },
          select: { id: true, name: true, email: true },
          order: { createdAt: 'ASC' },
        }),
      ]);

      if (!lead || typeof subjectTemplate !== 'string' || typeof bodyTemplate !== 'string') return;

      // Una cuenta no debería repetirse, pero se deduplica por dirección para no convertir una
      // migración antigua o una ficha duplicada en dos avisos para la misma bandeja.
      const sentTo = new Set<string>();
      for (const recipient of recipients) {
        const address = recipient.email?.trim().toLowerCase();
        if (!address || sentTo.has(address)) continue;
        sentTo.add(address);

        const { subject, html } = componerCorreo(subjectTemplate, bodyTemplate, {
          responsable: recipient.name,
          lead: lead.name,
          origen: lead.source?.replace(/_/g, ' ') || 'Sin origen informado',
          campana: lead.campaignName || 'Sin campaña',
          telefono: lead.phone || 'Sin teléfono',
          correo: lead.email || 'Sin correo',
        });
        const delivered = await this.email.send(address, subject, html);
        if (!delivered) {
          this.logger.warn(`No se entregó el aviso del lead ${lead.id} a ${address}`);
        }
      }
    } catch (error) {
      // Un correo no puede deshacer una captura ya confirmada. El evento se ejecuta después de
      // la transacción precisamente para que el CRM conserve el lead aunque SMTP esté caído.
      this.logger.error(
        `No se pudo preparar el aviso del lead ${event.leadId}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
