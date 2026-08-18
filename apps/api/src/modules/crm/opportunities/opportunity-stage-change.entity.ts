import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Paso de una oportunidad de una etapa a otra.
 *
 * `crm_opportunities.stage` guarda dónde está el trato hoy y pisa el valor anterior en cada
 * cambio. Con eso se puede decir cuántos tratos hay en negociación, pero no cuánto tardan en
 * llegar, ni por qué etapa se atascan, ni cuántos retroceden: toda pregunta sobre el
 * *recorrido* necesita las transiciones, y esas no estaban en ninguna parte.
 *
 * Cada fila es un hecho ocurrido y no se edita nunca. `durationHours` mide lo que el trato
 * pasó en la etapa que abandona —se calcula al escribir, contra la transición anterior— para
 * que un informe de duración por etapa sea una suma y no una ventana móvil sobre toda la
 * tabla.
 *
 * `fromStage` es nulo solo en la primera fila de cada trato, la que registra su apertura.
 */
@Entity('crm_opportunity_stage_changes')
@Index('IDX_opportunity_stage_changes_opportunity', ['opportunityId', 'createdAt'])
@Index('IDX_opportunity_stage_changes_org_stage', ['organizationId', 'toStage', 'createdAt'])
export class OpportunityStageChange {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'opportunity_id', type: 'uuid' }) opportunityId: string;

  /** Etapa que se abandona. Nulo en la apertura del trato. */
  @Column({ name: 'from_stage', type: 'varchar', length: 50, nullable: true }) fromStage?: string | null;
  @Column({ name: 'to_stage', type: 'varchar', length: 50 }) toStage: string;

  /**
   * Horas que el trato permaneció en `fromStage`.
   *
   * Nulo en la apertura, porque no hay etapa previa que medir.
   */
  @Column({ name: 'duration_hours', type: 'decimal', precision: 12, scale: 2, nullable: true })
  durationHours?: number | null;

  /**
   * Quién movió el trato. Nulo cuando lo movió el sistema y no una persona, que es como se
   * distingue un avance real de uno provocado por una automatización.
   */
  @Column({ name: 'changed_by', type: 'uuid', nullable: true }) changedBy?: string | null;

  /** Motivo de pérdida, copiado al cerrar. Evita releer el trato para explicar la caída. */
  @Column({ name: 'loss_reason', type: 'varchar', length: 60, nullable: true }) lossReason?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
