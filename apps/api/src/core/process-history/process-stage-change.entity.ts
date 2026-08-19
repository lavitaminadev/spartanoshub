import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Objetos cuyo recorrido se registra.
 *
 * Se nombran igual que en `process_comments` a propósito: quien lee una conversación y quien
 * lee un historial habla del mismo objeto, y dos vocabularios para lo mismo obligan a traducir
 * en cada consulta que los cruce.
 */
export enum ProcessSubject {
  /** Solicitud de trabajo: lo que se pidió. */
  WORK_REQUEST = 'work_request',
  /** Pieza: lo que se produce a partir de una solicitud. */
  PIECE = 'piece',
  /** Aprobación: la decisión sobre una pieza. */
  APPROVAL = 'approval',
}

/**
 * Paso de un objeto de una etapa a otra, cualquiera sea el proceso.
 *
 * Cada objeto guarda en su tabla dónde está hoy y pisa el valor anterior en cada cambio. Con eso
 * se puede decir cuántas piezas hay en revisión, pero no cuánto tardan en llegar, ni dónde se
 * atascan, ni cuántas retroceden: toda pregunta sobre el *recorrido* necesita las transiciones,
 * y solo el pipeline comercial las tenía.
 *
 * Generaliza `crm_opportunity_stage_changes`, que resolvió esto para los tratos. Aquel se
 * mantiene aparte porque guarda además el motivo de pérdida y alimenta las automatizaciones
 * comerciales; unificarlos obligaría a migrar filas en producción para no ganar nada.
 *
 * Cada fila es un hecho ocurrido y **no se edita nunca**. `durationHours` mide lo que el objeto
 * pasó en la etapa que abandona —se calcula al escribir, contra la transición anterior— para que
 * un informe de duración por etapa sea una suma y no una ventana móvil sobre toda la tabla.
 */
@Entity('process_stage_changes')
@Index('IDX_process_stage_changes_subject', ['subjectType', 'subjectId', 'createdAt'])
@Index('IDX_process_stage_changes_org_stage', ['organizationId', 'subjectType', 'toStage', 'createdAt'])
export class ProcessStageChange {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ name: 'subject_type', type: 'varchar', length: 30 }) subjectType: ProcessSubject;
  @Column({ name: 'subject_id', type: 'uuid' }) subjectId: string;

  /** Etapa que se abandona. Nulo solo en la fila que registra la apertura. */
  @Column({ name: 'from_stage', type: 'varchar', length: 50, nullable: true }) fromStage?: string | null;
  @Column({ name: 'to_stage', type: 'varchar', length: 50 }) toStage: string;

  /**
   * Horas que el objeto permaneció en `fromStage`.
   *
   * Nulo en la apertura, porque no hay etapa previa que medir, y también en objetos creados
   * antes de que existiera este registro: inventar una duración que nadie midió ensucia el
   * informe más que dejarla vacía.
   */
  @Column({ name: 'duration_hours', type: 'decimal', precision: 12, scale: 2, nullable: true })
  durationHours?: number | null;

  /**
   * Quién lo movió. Nulo cuando lo movió el sistema y no una persona, que es como se distingue
   * un avance real de uno provocado por una automatización o un vencimiento.
   */
  @Column({ name: 'changed_by', type: 'uuid', nullable: true }) changedBy?: string | null;

  /**
   * Motivo del cambio, cuando quien lo hizo dio uno.
   *
   * Guarda el texto y no una referencia porque explica una fila que ya no se edita: si el motivo
   * viviera en otra tabla y esa cambiara, el historial diría algo distinto de lo que ocurrió.
   */
  @Column({ type: 'varchar', length: 300, nullable: true }) reason?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
