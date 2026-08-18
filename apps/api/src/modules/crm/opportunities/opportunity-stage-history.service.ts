import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OpportunityStageChange } from './opportunity-stage-change.entity';
import type { Opportunity } from './opportunity.entity';

/** Etapas que cierran el trato. Al alcanzarlas deja de correr el reloj del pipeline. */
const CLOSING_STAGES = new Set(['won', 'lost']);

/**
 * Registro del recorrido de un trato por el pipeline.
 *
 * Hace dos cosas que van juntas y por eso viven en el mismo sitio: deja constancia de cada
 * transición y avisa al resto del sistema de que ocurrió. Separarlas permitiría que una
 * automatización reaccionara a un cambio que no quedó registrado, o al revés.
 *
 * **Nada de lo que pasa acá puede tumbar la operación comercial.** Si el registro falla, el
 * trato igual se mueve: perder una fila de historial degrada un informe, mientras que impedir
 * que alguien cierre una venta detiene el negocio. Por eso todo va envuelto y solo se registra
 * en el log.
 */
@Injectable()
export class OpportunityStageHistoryService {
  private readonly logger = new Logger(OpportunityStageHistoryService.name);

  constructor(
    @InjectRepository(OpportunityStageChange) private readonly changes: Repository<OpportunityStageChange>,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Deja constancia de la apertura del trato y avisa de ella.
   *
   * @param actorId - Persona que lo abrió; sin valor cuando lo abrió una automatización.
   */
  async recordCreated(opportunity: Opportunity, actorId?: string): Promise<void> {
    await this.safely(async () => {
      await this.changes.save(this.changes.create({
        organizationId: opportunity.organizationId,
        opportunityId: opportunity.id,
        fromStage: null,
        toStage: opportunity.stage,
        durationHours: null,
        changedBy: actorId ?? null,
      }));
      this.emit('deal.created', opportunity, undefined, actorId);
    }, `apertura del trato ${opportunity.id}`);
  }

  /**
   * Deja constancia de un cambio de etapa y avisa de él.
   *
   * No hace nada si la etapa no cambió: guardar una fila por cada edición del monto llenaría
   * el historial de transiciones que nunca ocurrieron y falsearía la duración por etapa.
   *
   * @param previousStage - Etapa desde la que se mueve, leída antes de guardar.
   * @param actorId - Persona que lo movió; sin valor cuando lo movió una automatización.
   */
  async recordStageChange(opportunity: Opportunity, previousStage: string, actorId?: string): Promise<void> {
    if (previousStage === opportunity.stage) return;

    await this.safely(async () => {
      await this.changes.save(this.changes.create({
        organizationId: opportunity.organizationId,
        opportunityId: opportunity.id,
        fromStage: previousStage,
        toStage: opportunity.stage,
        durationHours: await this.hoursSinceLastChange(opportunity.id),
        changedBy: actorId ?? null,
        lossReason: opportunity.stage === 'lost' ? opportunity.lossReason ?? null : null,
      }));

      this.emit('deal.stage_changed', opportunity, previousStage, actorId);
      // Ganado y perdido se anuncian aparte de `stage_changed` porque son los dos momentos a
      // los que algo va a querer reaccionar sin tener que inspeccionar la etapa de destino.
      if (opportunity.stage === 'won') this.emit('deal.won', opportunity, previousStage, actorId);
      if (opportunity.stage === 'lost') this.emit('deal.lost', opportunity, previousStage, actorId);
    }, `cambio de etapa del trato ${opportunity.id}`);
  }

  /**
   * Horas transcurridas desde la última transición registrada de este trato.
   *
   * Se mide contra la transición anterior y no contra la creación del trato: lo que interesa
   * es cuánto duró la etapa que se abandona, no la edad total del trato.
   *
   * Devuelve `null` cuando no hay transición previa —tratos abiertos antes de que existiera
   * este registro—, para no inventar una duración que nadie midió.
   */
  private async hoursSinceLastChange(opportunityId: string): Promise<number | null> {
    const last = await this.changes.findOne({
      where: { opportunityId },
      order: { createdAt: 'DESC' },
    });
    if (!last) return null;
    const hours = (Date.now() - last.createdAt.getTime()) / 3_600_000;
    return Math.round(hours * 100) / 100;
  }

  /** Publica el evento con la forma que consume el resto del sistema. */
  private emit(name: string, opportunity: Opportunity, previousStage?: string, actorId?: string): void {
    this.events.emit(name, {
      organizationId: opportunity.organizationId,
      opportunityId: opportunity.id,
      leadId: opportunity.leadId,
      clientId: opportunity.clientId,
      stage: opportunity.stage,
      previousStage,
      amount: opportunity.amount,
      assignedTo: opportunity.assignedTo,
      isClosing: CLOSING_STAGES.has(opportunity.stage),
      actorId,
    });
  }

  /** Ejecuta el registro sin dejar que su fallo alcance a quien mueve el trato. */
  private async safely(task: () => Promise<void>, description: string): Promise<void> {
    try {
      await task();
    } catch (error) {
      this.logger.error(`No se pudo registrar la ${description}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
