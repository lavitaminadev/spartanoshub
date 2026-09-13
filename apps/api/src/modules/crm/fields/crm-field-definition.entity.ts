import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { CustomFieldEntity, CustomFieldType } from '@espartanos/shared';

/**
 * La definición de un campo propio del CRM: su nombre, tipo y opciones.
 *
 * El valor no vive acá sino en `custom_fields` de cada registro, guardado por `fieldKey`. Por eso
 * la clave no se puede cambiar después de creada —renombrar sí, cambiar la clave dejaría huérfanos
 * todos los valores—, y por eso borrar no existe: se archiva.
 */
@Entity('crm_field_definitions')
@Index('UQ_crm_field_org_entity_key', ['organizationId', 'entity', 'fieldKey'], { unique: true })
@Index('IDX_crm_field_org_entity', ['organizationId', 'entity', 'archivedAt'])
export class CrmFieldDefinition {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ length: 20 }) entity: CustomFieldEntity;

  @Column({ name: 'field_key', length: 40 }) fieldKey: string;

  @Column({ length: 80 }) label: string;

  @Column({ length: 20 }) type: CustomFieldType;

  @Column({ type: 'json', nullable: true }) options?: string[] | null;

  @Column({ type: 'boolean', default: false }) required: boolean;

  @Column({ type: 'int', default: 0 }) position: number;

  /** Archivado: no se muestra ni se edita, pero lo guardado se conserva. */
  @Column({ name: 'archived_at', type: 'timestamp', nullable: true }) archivedAt?: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
