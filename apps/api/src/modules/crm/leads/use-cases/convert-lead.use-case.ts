import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Lead } from '../lead.entity';
import { LeadStatus } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';
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
    // Se guarda fuera de la transacción para poder anunciar el cambio de etapa una vez confirmada.
    let etapaPrevia = '';
    const result = await this.leadRepo.manager.transaction(async (manager: EntityManager) => {
      const lead = await manager.findOne(Lead, {
        where: { id: leadId, organizationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lead) throw new NotFoundException('Lead no encontrado');
      // Ganar una oportunidad y crear una empresa cliente son decisiones distintas. El lead
      // puede haberse cerrado primero; solo una conversión previa impide repetir la operación.
      if (lead.convertedToClientId) {
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

      etapaPrevia = lead.status;
      lead.status = LeadStatus.WON;
      /*
       * Convertir también califica.
       *
       * Este camino escribía la etapa y dejaba la calificación como estaba, así que un lead
       * que se cerró convirtiéndolo en cliente —que es como cierra el equipo comercial—
       * quedaba vendido y «pendiente de revisar» a la vez.
       */
      lead.fitStatus = LeadFitStatus.SOLD;
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
    /*
     * Convertir también cierra el lead, y eso hay que anunciarlo.
     *
     * Este camino ponía «Venta» con un guardado directo, sin anunciar la venta: quien
     * cerraba convirtiendo en cliente —que es como cierra el equipo comercial— dejaba a Meta sin
     * la señal que más pesa. Veía leads que llegaban a Negociación y desaparecían, y aprendía
     * que esa campaña no convierte.
     *
     * Solo si la etapa cambió de verdad: un lead ya cerrado que se convierte después no repite
     * el aviso, y el identificador de evento por etapa lo deduplicaría igualmente.
     */
    if (etapaPrevia !== LeadStatus.WON) {
      this.eventEmitter.emit('lead.won', {
        organizationId,
        leadId: result.lead.id,
        clientId: result.lead.clientId ?? null,
      });
    }
    return result;
  }
}
