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
@Index('UQ_crm_field_org_entity_key_client', ['organizationId', 'entity', 'fieldKey', 'clientId'], { unique: true })
@Index('IDX_crm_field_org_entity', ['organizationId', 'entity', 'archivedAt'])
export class CrmFieldDefinition {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ length: 20 }) entity: CustomFieldEntity;

  /**
   * Empresa a la que pertenece el campo. Vacío: de todas.
   *
   * Un campo que sólo una empresa necesita no tiene por qué aparecer en las fichas de las demás,
   * y uno obligatorio de una no debe bloquear el guardado de otra.
   */
  @Column({ name: 'client_id', type: 'varchar', length: 36, nullable: true }) clientId?: string | null;

  @Column({ name: 'field_key', length: 40 }) fieldKey: string;

  @Column({ length: 80 }) label: string;

  @Column({ length: 20 }) type: CustomFieldType;

  @Column({ type: 'json', nullable: true }) options?: string[] | null;

  @Column({ type: 'boolean', default: false }) required: boolean;

  @Column({ type: 'int', default: 0 }) position: number;

  /** Archivado: no se muestra ni se edita, pero lo guardado se conserva. */
  /**
   * Preguntas de los formularios de Meta que llenan este campo.
   *
   * El nombre de la pregunta lo escribe quien arma el anuncio y cambia entre campañas, así que
   * se guardan todas las variantes que apuntan al mismo dato. Vacío: el campo sólo se llena a mano.
   */
  @Column({ name: 'meta_questions', type: 'json', nullable: true }) metaQuestions?: string[] | null;

  @Column({ name: 'archived_at', type: 'timestamp', nullable: true }) archivedAt?: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true }) createdBy?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
