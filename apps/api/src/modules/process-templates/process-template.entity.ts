import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export interface ProcessTemplateStep {
  key: string;
  label: string;
  responsibleRole?: string;
  slaHours?: number;
  required: boolean;
}

/*
 * La tabla conserva su nombre a propósito.
 *
 * El módulo se renombró para dejar de confundirse con el motor de automatizaciones, pero
 * `workflow_templates` guarda las plantillas que ya están en uso y sus `code`
 * —`onboarding`, `production`, `audiovisual`, `monthly_cycle`— los leen cuatro procesos.
 * Renombrar la tabla obligaría a una migración de datos para no ganar nada: el nombre de la
 * tabla no lo lee nadie salvo esta línea.
 */
@Entity('workflow_templates')
@Index('UQ_workflow_templates_org_code', ['organizationId', 'code'], { unique: true })
export class ProcessTemplate {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ type: 'varchar', length: 50 }) code: string;
  @Column({ type: 'varchar', length: 150 }) name: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  @Column({ type: 'json' }) steps: ProcessTemplateStep[];
  @Column({ name: 'is_active', type: 'boolean', default: true }) isActive: boolean;
  @Column({ type: 'int', default: 1 }) version: number;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
