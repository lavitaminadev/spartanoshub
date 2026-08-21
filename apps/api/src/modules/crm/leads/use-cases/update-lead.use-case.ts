import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../lead.entity';
import { LeadStatus, isStatusInDomain } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';
import { ProcessHistoryService } from '../../../../core/process-history/process-history.service';
import { ProcessSubject } from '../../../../core/process-history/process-stage-change.entity';

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
  ) {}

  async execute(
    id: string,
    data: {
      status?: string; notes?: string; fitStatus?: string; discardReason?: string;
      tags?: string[]; estimatedAmount?: number; assignedTo?: string | null;
      source?: string; clientId?: string | null;
    },
    organizationId: string,
    actorId?: string,
  ) {
    const lead = await this.repo.findOne({ where: { id, organizationId } });
    if (!lead) throw new NotFoundException('Lead not found');

    // Se lee antes de pisarla: el registro necesita de dónde viene.
    const etapaPrevia = lead.status;

    if (data.status === LeadStatus.WON && !lead.convertedToClientId) {
      throw new BadRequestException('Para marcar un lead como ganado debes convertirlo en cliente');
    }
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
    if (data.notes !== undefined) lead.notes = data.notes;
    if (data.discardReason !== undefined) lead.discardReason = data.discardReason;
    if (data.tags !== undefined) lead.tags = data.tags;
    if (data.estimatedAmount !== undefined) lead.estimatedAmount = data.estimatedAmount;
    // `null` desasigna y `undefined` deja como está: son dos intenciones distintas y colapsarlas
    // haría imposible devolver un lead a la bandeja común desde la ficha.
    if (data.assignedTo !== undefined) lead.assignedTo = data.assignedTo ?? undefined;
    if (data.source !== undefined) lead.source = data.source;
    // Igual que el responsable: `null` lo deja sin cuenta y omitirlo no toca lo que había.
    if (data.clientId !== undefined) lead.clientId = data.clientId ?? undefined;

    const guardado = await this.repo.save(lead);

    // El registro de recorrido ya existía y los leads no lo escribían, así que su ficha no podía
    // mostrar por dónde pasó ni cuánto tardó en cada etapa. El motivo de descarte viaja como
    // motivo del paso: es lo que explica una salida del embudo y sin él el historial muestra un
    // cierre sin causa.
    await this.history.recordStageChange(
      organizationId, ProcessSubject.LEAD, guardado.id,
      etapaPrevia, guardado.status, actorId, guardado.discardReason,
    );
    return guardado;
  }
}
