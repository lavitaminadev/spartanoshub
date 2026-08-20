import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Automation } from './automation.entity';
import { AutomationRun } from './automation-run.entity';
import { AUTOMATION_TRIGGERS, findTrigger } from './automation-catalog';

/** Carga mínima que todo evento de dominio debe traer para poder disparar algo. */
interface TriggerPayload {
  organizationId: string;
  /**
   * Cuenta a la que pertenece el registro que provocó el evento.
   *
   * Es lo que permite acotar las automatizaciones por cuenta. Un evento que no la trae solo
   * puede disparar reglas transversales: sin saber de quién es el trato, ejecutar una regla
   * escrita para un cliente concreto sería adivinar.
   */
  clientId?: string | null;
  [key: string]: unknown;
}

/**
 * Convierte un evento de dominio en ejecuciones pendientes.
 *
 * Lo único que hace es **escribir filas**, y eso es deliberado. El bus de eventos de Nest es
 * síncrono y vive en memoria: si el proceso cae entre el evento y su manejador, lo que había
 * que hacer se pierde sin dejar rastro. Ejecutar acá mismo heredaría esa fragilidad y además
 * metería el trabajo de la automatización dentro de la petición que movió el trato, que es
 * como una acción de usuario termina tardando lo que tarda un correo.
 *
 * El ejecutor recoge después lo que quedó escrito.
 */
@Injectable()
export class AutomationTriggerListener {
  private readonly logger = new Logger(AutomationTriggerListener.name);

  constructor(
    @InjectRepository(Automation) private readonly automations: Repository<Automation>,
    @InjectRepository(AutomationRun) private readonly runs: Repository<AutomationRun>,
  ) {}

  @OnEvent('deal.created')
  handleDealCreated(payload: TriggerPayload) { return this.enqueue('deal.created', payload); }

  @OnEvent('deal.stage_changed')
  handleStageChanged(payload: TriggerPayload) { return this.enqueue('deal.stage_changed', payload); }

  @OnEvent('deal.won')
  handleDealWon(payload: TriggerPayload) { return this.enqueue('deal.won', payload); }

  @OnEvent('deal.lost')
  handleDealLost(payload: TriggerPayload) { return this.enqueue('deal.lost', payload); }

  @OnEvent('lead.converted')
  handleLeadConverted(payload: TriggerPayload) { return this.enqueue('lead.converted', payload); }

  @OnEvent('task.overdue')
  handleTaskOverdue(payload: TriggerPayload) { return this.enqueue('task.overdue', payload); }

  @OnEvent('deal.stale')
  handleDealStale(payload: TriggerPayload) { return this.enqueue('deal.stale', payload); }

  /**
   * Escribe una ejecución pendiente por cada automatización activa que escuche este evento.
   *
   * Nada de lo que ocurra acá puede alcanzar a quien provocó el evento: un fallo al encolar
   * degrada la automatización, pero cerrar una venta no puede fallar porque una automatización
   * esté mal configurada.
   */
  private async enqueue(triggerKey: string, payload: TriggerPayload): Promise<void> {
    try {
      const definition = findTrigger(triggerKey);
      if (!definition || !payload?.organizationId) return;

      const entityId = this.entityIdFrom(payload, definition.entityType);
      if (!entityId) {
        this.logger.warn(`Evento ${triggerKey} sin identificador de ${definition.entityType}; no se encola`);
        return;
      }

      /*
        Alcance por cuenta.

        Se piden las transversales (`client_id` nulo) y, si el evento dice de qué cuenta es, las
        escritas para esa cuenta. Nunca las de otra: ese es el punto del alcance.

        El filtro se hace en la consulta y no al recorrer el resultado. Con cientos de reglas,
        traerlas todas para descartar la mayoría en memoria es trabajo que se repite en cada
        evento del sistema, que es justamente el camino más caliente que hay.
      */
      const activas = await this.automations.find({
        where: payload.clientId
          ? [
            { organizationId: payload.organizationId, triggerType: triggerKey, isActive: true, clientId: IsNull() },
            { organizationId: payload.organizationId, triggerType: triggerKey, isActive: true, clientId: payload.clientId },
          ]
          : { organizationId: payload.organizationId, triggerType: triggerKey, isActive: true, clientId: IsNull() },
      });
      if (!activas.length) return;

      for (const automation of activas) {
        await this.enqueueOne(automation, definition.entityType, entityId, triggerKey, payload);
      }
    } catch (error) {
      this.logger.error(`No se pudieron encolar automatizaciones de ${triggerKey}: ${error instanceof Error ? error.message : error}`);
    }
  }

  private async enqueueOne(
    automation: Automation,
    entityType: string,
    entityId: string,
    triggerKey: string,
    payload: TriggerPayload,
  ): Promise<void> {
    /**
     * Identifica el hecho concreto, no solo el registro.
     *
     * Incluye el estado de destino porque un mismo trato pasa varias veces por
     * `stage_changed` y cada paso es un hecho distinto que debe ejecutarse. Sin ese matiz,
     * la guardia de unicidad haría que solo el primer cambio disparara algo.
     *
     * `occurredOn` lo traen los disparadores de tiempo, que se anuncian en cada pasada del
     * trabajo periódico mientras la condición siga cumpliéndose. Al llevar la fecha, un trato
     * vencido genera un aviso al día y no uno por hora: sin eso el equipo dejaría de mirarlos.
     */
    const stage = typeof payload.stage === 'string' ? payload.stage : '';
    const occurredOn = typeof payload.occurredOn === 'string' ? payload.occurredOn : '';
    const clave = `${triggerKey}:${entityId}:${stage}${occurredOn ? `:${occurredOn}` : ''}:${automation.version}`;

    const existente = await this.runs.findOne({
      where: { organizationId: automation.organizationId, automationId: automation.id, triggerKey: clave },
      select: { id: true },
    });
    if (existente) return;

    await this.runs.save(this.runs.create({
      organizationId: automation.organizationId,
      automationId: automation.id,
      automationVersion: automation.version,
      triggerKey: clave,
      entityType,
      entityId,
      status: 'pending',
      context: { ...payload },
    }));
  }

  /** Extrae el identificador del registro según el tipo que declara el disparador. */
  private entityIdFrom(payload: TriggerPayload, entityType: string): string | undefined {
    const candidatos: Record<string, unknown> = {
      opportunity: payload.opportunityId,
      lead: payload.leadId,
      contact: payload.contactId,
      reservation: payload.reservationId,
      service_request: payload.serviceRequestId,
      approval: payload.approvalId,
    };
    const value = candidatos[entityType];
    return typeof value === 'string' ? value : undefined;
  }
}

/** Eventos que este oyente atiende, para poder verificarlo en pruebas. */
export const HANDLED_TRIGGER_EVENTS = AUTOMATION_TRIGGERS.map((trigger) => trigger.event);
