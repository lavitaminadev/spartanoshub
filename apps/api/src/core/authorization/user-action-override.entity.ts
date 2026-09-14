import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Una acción abierta o cerrada para una persona, por encima de lo que da su nivel en el módulo.
 *
 * Sólo se guardan las desviaciones: sin fila, la acción sigue al nivel (ver `acciones.ts`).
 */
@Entity('user_action_overrides')
@Index('UQ_user_action_override', ['userId', 'action'], { unique: true })
export class UserActionOverride {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ name: 'user_id', type: 'uuid' }) userId: string;

  /** Clave de `ACCIONES`, por ejemplo `crm.importar`. */
  @Column({ type: 'varchar', length: 60 }) action: string;

  @Column({ type: 'boolean' }) allowed: boolean;

  @Column({ type: 'varchar', length: 300, nullable: true }) reason?: string | null;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true }) grantedBy?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
