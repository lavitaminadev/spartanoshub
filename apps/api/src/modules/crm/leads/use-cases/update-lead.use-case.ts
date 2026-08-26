import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../lead.entity';
import { LeadStatus, isStatusInDomain } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';
import { ProcessHistoryService } from '../../../../core/process-history/process-history.service';
import { ProcessSubject } from '../../../../core/process-history/process-stage-change.entity';
import { LeadCierreService } from '../lead-cierre.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/** Nombre del dominio en los mensajes de error, para que digan algo accionable. */
const DOMAIN_LABELS: Record<string, string> = {
  commercial: 'el embudo comercial',
  audience: 'la audiencia de un local',
};

@Injectable()
export class UpdateLeadUseCase {
  constructor(
    @InjectRepository(Lead) private repo: Repository<Lead>,
    private readonly history: ProcessHistoryService,
    private readonly cierre: LeadCierreService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    id: string,
    data: {
      name?: string; phone?: string; email?: string; company?: string;
      campaignName?: string;
      status?: string; notes?: string; fitStatus?: string; discardReason?: string;
      tags?: string[]; estimatedAmount?: number; assignedTo?: string | null;
      source?: string; clientId?: string | null; trafficLight?: 'green' | 'yellow' | 'red' | null;
    },
    organizationId: string,
    actorId?: string,
  ) {
    const lead = await this.repo.findOne({ where: { id, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    // Se lee antes de pisarla: el registro necesita de dónde viene.
    const etapaPrevia = lead.status;

    if (data.status && Object.values(LeadStatus).includes(data.status as LeadStatus)) {
      // El estado tiene que pertenecer al dominio del lead. El enumerado los contiene todos
      // porque la columna es una sola, pero un comensal no atraviesa el embudo comercial: sin
      // esta comprobación se lo podía marcar como `negotiation` y aparecía en el pronóstico.
      if (!isStatusInDomain(lead.domain, data.status as LeadStatus)) {
        throw new BadRequestException(
          `El estado "${data.status}" no corresponde a un lead de ${DOMAIN_LABELS[lead.domain] ?? lead.domain}`,
        );
      }
      lead.status = data.status as LeadStatus;
    }
    if (data.fitStatus && Object.values(LeadFitStatus).includes(data.fitStatus as LeadFitStatus)) {
      lead.fitStatus = data.fitStatus as LeadFitStatus;
    }
    /*
     * Identidad y contacto. Se recorta el espacio sobrante y una cadena vacía deja el campo en
     * nulo: guardar «   » como teléfono es guardar un dato que parece existir y no sirve.
     */
    if (data.name !== undefined && data.name.trim()) lead.name = data.name.trim();
    if (data.phone !== undefined) lead.phone = data.phone.trim() || null;
    if (data.email !== undefined) lead.email = data.email.trim() || null;
    if (data.company !== undefined) lead.company = data.company.trim() || null;
    // La entidad ya recorta la campaña al guardar; acá basta con distinguir «déjala como está»
    // de «quítala», que es lo que separa omitir el campo de mandarlo vacío.
    if (data.campaignName !== undefined) lead.campaignName = data.campaignName.trim() || null;
    if (data.notes !== undefined) lead.notes = data.notes;
    if (data.discardReason !== undefined) lead.discardReason = data.discardReason;
    if (data.tags !== undefined) lead.tags = data.tags;
    if (data.estimatedAmount !== undefined) lead.estimatedAmount = data.estimatedAmount;
    if (data.trafficLight !== undefined) lead.trafficLight = data.trafficLight;
    // `null` desasigna y `undefined` deja como está: son dos intenciones distintas y colapsarlas
    // haría imposible devolver un lead a la bandeja común desde la ficha.
    if (data.assignedTo !== undefined) lead.assignedTo = data.assignedTo;
    if (data.source !== undefined) lead.source = data.source;
    // Igual que el responsable: `null` lo deja sin cuenta y omitirlo no toca lo que había.
    if (data.clientId !== undefined) lead.clientId = data.clientId;

    const guardado = await this.repo.save(lead);

    // El registro de recorrido ya existía y los leads no lo escribían, así que su ficha no podía
    // mostrar por dónde pasó ni cuánto tardó en cada etapa. El motivo de descarte viaja como
    // motivo del paso: es lo que explica una salida del embudo y sin él el historial muestra un
    // cierre sin causa.
    await this.history.recordStageChange(
      organizationId, ProcessSubject.LEAD, guardado.id,
      etapaPrevia, guardado.status, actorId, guardado.discardReason,
    );
    // Y si con esto el lead llegó al final, se avisa a quien lo llevaba: hasta ahora un lead se
    // cerraba en silencio y quien lo repartió no se enteraba nunca.
    await this.cierre.avisar(guardado, etapaPrevia, actorId);

    /*
     * Cada cambio de etapa se anuncia, para que Meta pueda aprender qué anuncios traen leads que
     * terminan en venta y cuáles traen los que se descartan.
     *
     * Se emite solo cuando la etapa cambió de verdad: guardar un teléfono corregido no es un
     * paso del embudo, y contarlo como tal ensuciaría la señal que se le devuelve a Meta.
     *
     * Va como evento y no como llamada directa porque este caso de uso no debe saber que Meta
     * existe: quien escucha decide si ese lead vino de un formulario instantáneo, si su empresa
     * tiene la capacidad contratada y a qué Pixel corresponde.
     */
    if (etapaPrevia !== guardado.status) {
      this.eventEmitter.emit('lead.stage-changed', {
        organizationId,
        leadId: guardado.id,
        clientId: guardado.clientId ?? null,
        fromStage: etapaPrevia,
        toStage: guardado.status,
      });
    }

    return guardado;
  }
}
