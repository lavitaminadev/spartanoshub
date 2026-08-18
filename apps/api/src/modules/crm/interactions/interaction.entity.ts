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
  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' }) date: Date;
  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}
