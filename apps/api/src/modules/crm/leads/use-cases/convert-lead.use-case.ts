import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Lead } from '../lead.entity';
import { LeadStatus } from '../lead-status.enum';
import { Client } from '../../../clients/client.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClientStatus } from '../../../clients/client-status.enum';

@Injectable()
export class ConvertLeadUseCase {
  constructor(
    @InjectRepository(Lead) private leadRepo: Repository<Lead>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    private eventEmitter: EventEmitter2,
  ) {}

  async execute(leadId: string, organizationId: string) {
    const result = await this.leadRepo.manager.transaction(async (manager: EntityManager) => {
      const lead = await manager.findOne(Lead, {
        where: { id: leadId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lead) throw new NotFoundException('Lead no encontrado');
      if (lead.status === LeadStatus.WON || lead.convertedToClientId) {
        throw new ConflictException('El lead ya fue convertido');
      }

      /*
       * Solo se convierte un prospecto de la agencia.
       *
       * Convertir crea una **empresa cliente**: alguien a quien la agencia le presta servicios y
       * factura. Un contacto de campaña es otra cosa —una persona que reservó mesa en el local de
       * un cliente— y convertirlo metía a un comensal en la cartera de la agencia, con su nombre
       * como razón social. La cartera se ensuciaba de a uno, sin que nada fallara.
       *
       * Además dejaba el lead en un estado que su embudo no admite, porque convertir fuerza
       * `won` y el ciclo de reserva no lo tiene: el contacto desaparecía del tablero de su local.
       */
      if (lead.domain === 'audience') {
        throw new BadRequestException(
          'Un contacto de campaña no se convierte en empresa cliente: es una persona que respondió '
          + 'a la campaña de un local, no alguien a quien la agencia le presta servicios.',
        );
      }

      const client = manager.create(Client, {
        organizationId,
        name: lead.name,
        leadId: lead.id,
        status: ClientStatus.ONBOARDING,
      });
      const savedClient = await manager.save(Client, client);

      lead.status = LeadStatus.WON;
      lead.convertedAt = new Date();
      lead.convertedToClientId = savedClient.id;
      await manager.save(Lead, lead);

      return { lead, client: savedClient };
    });
    this.eventEmitter.emit('lead.converted', {
      organizationId,
      leadId: result.lead.id,
      clientId: result.client.id,
    });
    return result;
  }
}
