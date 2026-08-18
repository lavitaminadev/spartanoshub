import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Estados de una ejecución.
 *
 * `waiting` es el que hace innecesaria toda infraestructura de colas: una espera no ocupa
 * proceso ni memoria, es una fila con fecha de reanudación que un trabajo periódico recoge.
 */
export type AutomationRunStatus =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Una ejecución de una automatización sobre un registro concreto.
 *
 * Existe como fila y no como llamada en memoria por una razón concreta: el bus de eventos de
 * Nest es síncrono y vive en el proceso, así que si el proceso muere entre el evento y su
 * manejador, lo que había que hacer se pierde sin dejar rastro. Para avisos eso es tolerable;
 * para una automatización que asigna responsables y crea tareas, no. El disparador escribe
 * acá y recién después alguien ejecuta.
 *
 * `triggerKey` es lo que impide ejecutar dos veces por el mismo hecho: se compone del evento
 * y del registro que lo provocó, y un índice único lo respalda. Sin él, un reintento tras un
 * fallo parcial volvería a enviar los correos que ya salieron.
 */
@Entity('automation_runs')
@Index('UQ_automation_runs_trigger', ['organizationId', 'automationId', 'triggerKey'], { unique: true })
@Index('IDX_automation_runs_resume', ['status', 'resumeAt'])
export class AutomationRun {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'automation_id', type: 'uuid' }) automationId: string;

  /** Versión del grafo con la que empezó. La ejecución la respeta hasta terminar. */
  @Column({ name: 'automation_version', type: 'int', default: 1 }) automationVersion: number;

  /** Identifica el hecho que la disparó. Único por automatización. */
  @Column({ name: 'trigger_key', type: 'varchar', length: 190 }) triggerKey: string;

  /** Registro sobre el que actúa: `opportunity`, `lead`, `reservation`… */
  @Column({ name: 'entity_type', type: 'varchar', length: 40 }) entityType: string;
  @Column({ name: 'entity_id', type: 'uuid' }) entityId: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: AutomationRunStatus;

  /**
   * Datos acumulados: la carga del evento más lo que cada nodo haya producido.
   *
   * Es lo que permite que una acción use el resultado de la anterior sin volver a consultar
   * la base, y lo que se conserva intacto durante una espera de días.
   */
  @Column({ type: 'json', nullable: true }) context?: Record<string, unknown> | null;

  /** Nodo por el que debe continuar. Nulo al empezar: arranca por el disparador. */
  @Column({ name: 'current_node_id', type: 'varchar', length: 60, nullable: true })
  currentNodeId?: string | null;

  /**
   * Momento a partir del cual puede continuar.
   *
   * Es la única pieza que hace falta para las esperas: un trabajo por minuto recoge las
   * ejecuciones cuya fecha ya pasó. "Esperar dos horas" es escribir una fecha, no mantener
   * nada corriendo.
   */
  @Column({ name: 'resume_at', type: 'timestamp', nullable: true }) resumeAt?: Date | null;

  @Column({ type: 'int', default: 0 }) attempts: number;
  @Column({ name: 'last_error', type: 'text', nullable: true }) lastError?: string | null;

  @Column({ name: 'started_at', type: 'timestamp', nullable: true }) startedAt?: Date | null;
  @Column({ name: 'finished_at', type: 'timestamp', nullable: true }) finishedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
