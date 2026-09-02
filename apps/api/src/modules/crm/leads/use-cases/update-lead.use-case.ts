import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../lead.entity';
import { LeadStatus, isStatusInDomain } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';
import { ProcessHistoryService } from '../../../../core/process-history/process-history.service';
import { ProcessSubject } from '../../../../core/process-history/process-stage-change.entity';
import { LeadCierreService } from '../lead-cierre.service';
import { ResponsablesDelCrmService } from '../responsables-del-crm.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

/** Nombre del dominio en los mensajes de error, para que digan algo accionable. */
const DOMAIN_LABELS: Record<string, string> = {
  commercial: 'el embudo comercial',
  audience: 'la audiencia de un local',
};

/**
 * Etapas que deciden la calificación por sí solas.
 *
 * Solo el desenlace. Una venta es la afirmación más fuerte de que el lead encajaba, y un descarte
 * la contraria; ninguna de las dos necesita que alguien la escriba aparte.
 *
 * Las etapas intermedias **no** califican, aunque parezca que sí. Que alguien agende una visita
 * no significa que el lead le sirva —se agenda para averiguarlo—, y marcarlo calificado por eso
 * convierte el campo en una copia de la etapa. La calificación es un eje aparte: dice cuánto vale
 * el lead, no dónde va, y quien la decide es la persona que habló con él.
 */
const DESENLACES = {
  [LeadStatus.WON]: LeadFitStatus.SOLD,
  [LeadStatus.LOST]: LeadFitStatus.UNQUALIFIED,
} as Partial<Record<LeadStatus, LeadFitStatus>>;

@Injectable()
export class UpdateLeadUseCase {
  constructor(
    @InjectRepository(Lead) private repo: Repository<Lead>,
    private readonly history: ProcessHistoryService,
    private readonly cierre: LeadCierreService,
    private readonly eventEmitter: EventEmitter2,
    private readonly responsables: ResponsablesDelCrmService,
  ) {}

  async execute(
    id: string,
    data: {
      name?: string; phone?: string; email?: string; company?: string;
      campaignName?: string;
      status?: string; notes?: string; fitStatus?: string; discardReason?: string;
      tags?: string[]; estimatedAmount?: number; assignedTo?: string | null;
      source?: string; clientId?: string | null; trafficLight?: 'green' | 'yellow' | 'red' | null;
      excludedFromMeta?: boolean;
    },
    organizationId: string,
    actorId?: string,
    actorClientId?: string | null,
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
      /*
       * El reloj de la inactividad se reinicia solo cuando la etapa cambia de verdad.
       *
       * Puesto acá y no en un `@BeforeUpdate` porque la entidad no sabe cuál era la etapa
       * anterior: guardar cualquier otro campo lo reiniciaría, y entonces el lead que más se
       * toca sería el que nunca avisa de estar parado.
       */
      if (etapaPrevia !== lead.status) {
        lead.stageChangedAt = new Date();
        // Se olvida lo ya avisado: un lead que avanzó y se vuelve a parar merece un aviso nuevo.
        // Sin esto, el primer aviso de su vida sería también el último.
        lead.idleAlertedLevel = null;
      }
    }
    // Antes de que nada la toque: es lo que permite distinguir «pasó a calificado ahora» de
    // «ya estaba calificado y se guardó otra cosa». Sin esto, cada guardado reenviaría el evento.
    const calificacionPrevia = lead.fitStatus;
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
    if (data.excludedFromMeta !== undefined) lead.excludedFromMeta = data.excludedFromMeta;
    // `null` desasigna y `undefined` deja como está: son dos intenciones distintas y colapsarlas
    // haría imposible devolver un lead a la bandeja común desde la ficha.
    if (data.assignedTo !== undefined) lead.assignedTo = data.assignedTo;
    if (data.source !== undefined) lead.source = data.source;
    // Igual que el responsable: `null` lo deja sin cuenta y omitirlo no toca lo que había.
    if (data.clientId !== undefined) lead.clientId = data.clientId;

    /*
     * Solo el desenlace decide la calificación por su cuenta.
     *
     * La calificación dice cuánto vale el lead; la etapa, dónde va. Son dos preguntas distintas y
     * un lead puede estar en «Contactado» y ya valer la pena. Dejarlas atadas convertía el campo
     * en una copia de la etapa y le quitaba a quien vende la única forma que tiene de decir «este
     * me interesa» antes de que se note en el embudo.
     *
     * Un cambio manual en la misma petición gana: quien la corrige a mano sabe algo que la etapa
     * no sabe.
     */
    if (data.fitStatus === undefined && lead.domain === 'commercial' && etapaPrevia !== lead.status) {
      const automatica = DESENLACES[lead.status as LeadStatus];
      if (automatica) lead.fitStatus = automatica;
    }

    /*
     * Mover un lead sin dueño lo pone a nombre de quien lo movió, si es el único que puede
     * atenderlo.
     *
     * En una empresa con una sola persona en el CRM, elegir responsable es escoger de una lista
     * de uno: el trámite no aporta la información que un responsable debería aportar, y el lead
     * se queda sin dueño por pura fricción. Avanzar la etapa ya afirma haberlo trabajado.
     *
     * Con dos o más, la regla se retira y la asignación vuelve a ser explícita. Quién atiende a
     * quién es entonces un reparto real, y el CRM ya lo ofrece en la ficha y en el botón «Tomar»
     * de la tarjeta. Además, el perfil de venta solo ve lo suyo: asignar por haber movido una
     * etapa le quitaría el lead de la vista a sus compañeros sin que nadie lo decidiera.
     *
     * Solo alcanza a quien pertenece a la empresa del lead. Desde la agencia se supervisa un
     * embudo sin venderlo, y quedarse como responsable por corregir una etapa atribuiría ese
     * trabajo a quien no lo hace.
     *
     * Una asignación explícita en la misma petición manda: quien eligió responsable ya decidió.
     */
    if (
      data.assignedTo === undefined
      && !lead.assignedTo
      && actorId
      && etapaPrevia !== lead.status
      && lead.clientId
      && actorClientId === lead.clientId
    ) {
      const equipo = await this.responsables.execute(organizationId, lead.clientId);
      if (equipo.length === 1 && equipo[0].id === actorId) lead.assignedTo = actorId;
    }

    /*
     * Descartar exige decir por qué, y se comprueba acá y no en la pantalla.
     *
     * La ficha ya lo pedía, pero arrastrar la tarjeta al tablero y mover en lote mandaban solo el
     * estado: la mitad de los descartes se guardaban sin causa y el informe de por qué se pierden
     * negocios quedaba a medias. Puesto en el caso de uso, ningún camino puede saltárselo.
     *
     * Se exige solo cuando el descarte es **nuevo**: un lead ya descartado al que se le corrige
     * el teléfono no vuelve a pedir el motivo que ya tiene.
     */
    if (lead.status === LeadStatus.LOST && etapaPrevia !== LeadStatus.LOST && !lead.discardReason?.trim()) {
      throw new BadRequestException('Para descartar un lead hay que indicar el motivo');
    }

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
     * Dos señales, no siete.
     *
     * Antes se anunciaba cada cambio de etapa y Meta recibía un evento distinto por cada paso del
     * embudo. Repartía la señal entre siete nombres con pocas conversiones cada uno, que es la
     * forma más segura de que no aprenda nada: para optimizar necesita volumen sobre un mismo
     * hecho, no el detalle del recorrido.
     *
     * Ahora se anuncian los dos hechos que a Meta le sirven de verdad: que alguien afirmó que
     * este lead vale la pena, y que compró. El descarte no se anuncia; Meta aprende de lo que
     * recibe, y un evento de «malo» no le enseña a evitar ese perfil, solo ensucia el conjunto.
     *
     * Van como eventos y no como llamada directa porque este caso de uso no debe saber que Meta
     * existe: quien escucha decide el Pixel, la capacidad contratada y el formato.
     */
    if (
      lead.fitStatus === LeadFitStatus.QUALIFIED
      && calificacionPrevia !== LeadFitStatus.QUALIFIED
    ) {
      this.eventEmitter.emit('lead.qualified', {
        organizationId,
        leadId: guardado.id,
        clientId: guardado.clientId ?? null,
      });
    }

    if (etapaPrevia !== guardado.status && guardado.status === LeadStatus.WON) {
      this.eventEmitter.emit('lead.won', {
        organizationId,
        leadId: guardado.id,
        clientId: guardado.clientId ?? null,
      });
    }

    /*
     * El descarte también se anuncia.
     *
     * En Events Manager se clasifica como «otra etapa»: le enseña a Meta qué perfiles no
     * buscamos, que es la mitad del contraste que necesita para distinguir un buen lead.
     *
     * **Solo del embudo comercial.** `lost` lo comparten los dos dominios —una reserva que no
     * se concretó se cierra igual que una venta que no se ganó— y son cosas distintas: un
     * comensal que no fue a comer no es un prospecto que no servía. Mezclarlos le enseñaría a
     * Meta a evitar perfiles por un motivo que no tiene nada que ver.
     */
    if (etapaPrevia !== guardado.status && guardado.status === LeadStatus.LOST && guardado.domain === 'commercial') {
      this.eventEmitter.emit('lead.discarded', {
        organizationId,
        leadId: guardado.id,
        clientId: guardado.clientId ?? null,
      });
    }

    return guardado;
  }
}
