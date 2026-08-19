import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessStageChange, ProcessSubject } from './process-stage-change.entity';

/** Una etapa del recorrido, ya resuelta para mostrar o sumar. */
export interface StageDuration {
  stage: string;
  /** Veces que algún objeto abandonó esta etapa. */
  transitions: number;
  /** Horas promedio que permaneció en ella. */
  averageHours: number;
}

/**
 * Registro del recorrido de solicitudes, piezas y aprobaciones.
 *
 * **Nada de lo que pasa acá puede detener la operación.** Si el registro falla, el objeto igual
 * se mueve: perder una fila de historial degrada un informe, mientras que impedir que alguien
 * apruebe una pieza detiene el trabajo. Por eso todo va envuelto y solo se anota en el log.
 *
 * Sigue el patrón que el pipeline comercial ya probó, con una diferencia: no publica eventos.
 * Quien mueve el objeto ya avisa por su cuenta, y duplicar el aviso haría que una automatización
 * corriera dos veces por el mismo cambio.
 */
@Injectable()
export class ProcessHistoryService {
  private readonly logger = new Logger(ProcessHistoryService.name);

  constructor(
    @InjectRepository(ProcessStageChange) private readonly changes: Repository<ProcessStageChange>,
  ) {}

  /**
   * Deja constancia de la apertura de un objeto, que es la primera fila de su recorrido.
   *
   * @param actorId - Quien lo abrió; sin valor cuando lo abrió el sistema.
   */
  async recordCreated(
    organizationId: string,
    subjectType: ProcessSubject,
    subjectId: string,
    stage: string,
    actorId?: string,
  ): Promise<void> {
    await this.safely(() => this.changes.save(this.changes.create({
      organizationId,
      subjectType,
      subjectId,
      fromStage: null,
      toStage: stage,
      durationHours: null,
      changedBy: actorId ?? null,
    })), `apertura de ${subjectType} ${subjectId}`);
  }

  /**
   * Deja constancia de un cambio de etapa.
   *
   * No hace nada si la etapa no cambió: una fila por cada edición del título llenaría el
   * historial de transiciones que nunca ocurrieron y falsearía la duración por etapa.
   *
   * @param previousStage - Etapa desde la que se mueve, leída antes de guardar.
   * @param actorId - Quien lo movió; sin valor cuando lo movió el sistema.
   * @param reason - Motivo, cuando quien lo movió dio uno.
   */
  async recordStageChange(
    organizationId: string,
    subjectType: ProcessSubject,
    subjectId: string,
    previousStage: string,
    stage: string,
    actorId?: string,
    reason?: string | null,
  ): Promise<void> {
    if (previousStage === stage) return;

    await this.safely(async () => {
      await this.changes.save(this.changes.create({
        organizationId,
        subjectType,
        subjectId,
        fromStage: previousStage,
        toStage: stage,
        durationHours: await this.hoursSinceLastChange(subjectType, subjectId),
        changedBy: actorId ?? null,
        reason: reason ?? null,
      }));
    }, `cambio de etapa de ${subjectType} ${subjectId}`);
  }

  /**
   * Recorrido completo de un objeto, del más antiguo al más reciente.
   *
   * En ese orden y no al revés porque se lee como una historia: se quiere saber por dónde pasó,
   * no cuál fue lo último.
   */
  async timeline(subjectType: ProcessSubject, subjectId: string): Promise<ProcessStageChange[]> {
    return this.changes.find({
      where: { subjectType, subjectId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Cuánto tarda en promedio cada etapa de un proceso.
   *
   * Agrupa por la etapa **abandonada**, no por la de destino: la pregunta es cuánto se demora
   * algo en salir de revisión, y esa duración la lleva la fila que la abandona.
   *
   * @param since - Momento desde el cual contar. Sin valor cuenta todo el historial.
   */
  async stageDurations(
    organizationId: string,
    subjectType: ProcessSubject,
    since?: Date,
  ): Promise<StageDuration[]> {
    const query = this.changes.createQueryBuilder('change')
      .select('change.from_stage', 'stage')
      .addSelect('COUNT(*)', 'transitions')
      .addSelect('AVG(change.duration_hours)', 'averageHours')
      .where('change.organization_id = :organizationId', { organizationId })
      .andWhere('change.subject_type = :subjectType', { subjectType })
      // La apertura no mide nada, y los objetos anteriores a este registro tampoco.
      .andWhere('change.from_stage IS NOT NULL')
      .andWhere('change.duration_hours IS NOT NULL')
      .groupBy('change.from_stage');

    if (since) query.andWhere('change.created_at >= :since', { since });

    const rows = await query.getRawMany<{ stage: string; transitions: string; averageHours: string }>();
    return rows.map((row) => ({
      stage: row.stage,
      transitions: Number(row.transitions),
      averageHours: Math.round(Number(row.averageHours) * 100) / 100,
    }));
  }

  /**
   * Horas transcurridas desde la última transición registrada de este objeto.
   *
   * Se mide contra la transición anterior y no contra su creación: lo que interesa es cuánto
   * duró la etapa que se abandona, no la edad total del objeto.
   *
   * Devuelve `null` cuando no hay transición previa —objetos creados antes de que existiera
   * este registro—, para no inventar una duración que nadie midió.
   */
  private async hoursSinceLastChange(subjectType: ProcessSubject, subjectId: string): Promise<number | null> {
    const last = await this.changes.findOne({
      where: { subjectType, subjectId },
      order: { createdAt: 'DESC' },
    });
    if (!last) return null;
    const hours = (Date.now() - last.createdAt.getTime()) / 3_600_000;
    return Math.round(hours * 100) / 100;
  }

  /** Ejecuta el registro sin dejar que su fallo alcance a quien mueve el objeto. */
  private async safely(task: () => Promise<unknown>, description: string): Promise<void> {
    try {
      await task();
    } catch (error) {
      this.logger.error(`No se pudo registrar la ${description}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
