import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Una acción abierta o cerrada para una persona, por encima de lo que da su nivel en el módulo.
 *
 * Sólo se guardan las desviaciones: sin fila, la acción sigue al nivel (ver `acciones.ts`).
 */
@Entity('user_action_overrides')
// La empresa entra en la clave a través de `client_scope`, la columna espejo que crea la 0189:
// MySQL trata cada NULL como distinto, así que una única sobre `client_id` dejaría pasar dos
// ajustes generales de la misma acción.
@Index('UQ_user_action_override_client', ['userId', 'action', 'clientScope'], { unique: true })
export class UserActionOverride {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  @Column({ name: 'user_id', type: 'uuid' }) userId: string;

  /** Clave de `ACCIONES`, por ejemplo `crm.importar`. */
  @Column({ type: 'varchar', length: 60 }) action: string;

  /**
   * Empresa en la que rige el ajuste. Vacío: en todas las que esa persona alcanza.
   *
   * El vacío no es un dato que falte: para el equipo interno es la lectura correcta —su alcance
   * es su pod y no una empresa— y para una cuenta de portal es lo que hacían todos los ajustes
   * antes de que esta columna existiera. Acotarlo a una empresa es una decisión que se toma
   * viendo el caso, no una conversión automática.
   */
  @Column({ name: 'client_id', type: 'varchar', length: 36, nullable: true }) clientId?: string | null;

  /**
   * Espejo de `clientId` con un texto fijo cuando no hay empresa. La escribe la base.
   *
   * No se asigna nunca desde el código: es una columna generada, y sólo está declarada para que
   * el índice único la pueda nombrar.
   */
  @Column({ name: 'client_scope', type: 'varchar', length: 36, insert: false, update: false, select: false, nullable: true }) clientScope?: string;

  @Column({ type: 'boolean' }) allowed: boolean;

  @Column({ type: 'varchar', length: 300, nullable: true }) reason?: string | null;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true }) grantedBy?: string | null;

  /**
   * Hasta cuándo rige el ajuste. Vacío: sin fecha de término. Vencido, la acción vuelve a seguir
   * al nivel de su módulo, igual que si no existiera la fila.
   */
  @Column({ name: 'expires_at', type: 'timestamp', nullable: true }) expiresAt?: Date | null;

  /** Cuándo se avisó a quien lo concedió que está por vencer. */
  @Column({ name: 'expiry_notified_at', type: 'timestamp', nullable: true }) expiryNotifiedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
