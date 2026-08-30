import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Organization } from '../../organizations/organization.entity';

/**
 * Hecho registrado sobre un lead o un contacto.
 *
 * Desde que los hilos de `process_comments` alcanzan también al CRM, el reparto es este: acá
 * van los hechos que anota el sistema —la captura, la calificación, el descarte— y allá va lo
 * que escriben las personas. Mezclarlos hacía que el historial de un lead intercalara notas
 * humanas con eventos automáticos sin nada que los distinguiera.
 */
@Entity('crm_interactions')
@Index('IDX_crm_interactions_org_lead_date', ['organizationId', 'leadId', 'date'])
export class Interaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @ManyToOne(() => Organization) @JoinColumn({ name: 'organization_id' }) organization: Organization;
  @Column({ name: 'lead_id', type: 'uuid', nullable: true }) leadId?: string;
  @Column({ name: 'contact_id', type: 'uuid', nullable: true }) contactId?: string;
  @Column({ type: 'varchar', length: 50 }) type: string;
  @Column({ type: 'text', nullable: true }) description?: string;
  /**
   * Por dónde ocurre: `meet`, `zoom`, `teams`, `presencial`, `telefono`.
   *
   * Columna propia y no una frase dentro de la descripción: ahí no se puede filtrar ni meter en
   * un recordatorio, y cada persona lo escribe distinto. Vacío en lo que no tiene medio, como
   * una nota.
   */
  @Column({ type: 'varchar', length: 40, nullable: true }) medium?: string | null;

  /**
   * Dónde: el enlace de la videollamada o la dirección.
   *
   * Separado del medio porque son cosas distintas —uno es un valor de una lista corta y el otro
   * texto libre— y juntarlos obligaría a interpretar la cadena para saber cuál es cuál. Es lo
   * que el recordatorio previo necesita para servir de algo.
   */
  @Column({ type: 'varchar', length: 500, nullable: true }) location?: string | null;
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) date: Date;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
