import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { PermissionLevel } from './permission-level';

/**
 * Ajuste de una celda de la matriz de cargos para una organización.
 *
 * La matriz base es `ROLE_PERMISSIONS` en `role-permissions.ts` y sigue siendo una decisión
 * de producto que se revisa en código. Esta tabla guarda solo las celdas movidas: la ausencia
 * de fila para un par cargo/módulo significa "lo que diga el código".
 *
 * Guardar la matriz entera tendría un efecto que nadie querría: al agregar un módulo al
 * catálogo, la copia guardada no lo conocería y el módulo quedaría en `none` para todos los
 * cargos sin que nada lo explique. Con diferencias, el módulo nuevo hereda su definición de
 * código desde el primer despliegue.
 *
 * Devolver una celda a su valor de código se hace borrando la fila, no guardando el mismo
 * valor: así el ajuste desaparece y la celda vuelve a seguir al código si este cambia.
 */
@Entity('role_permission_overrides')
@Index('UQ_role_permission_override', ['organizationId', 'role', 'module'], { unique: true })
export class RolePermissionOverride {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /** Clave del cargo, coincidente con `UserRole`. */
  @Column({ type: 'varchar', length: 40 }) role: string;

  /** Clave del módulo, coincidente con `ORGANIZATION_FEATURE_KEYS`. */
  @Column({ type: 'varchar', length: 60 }) module: string;

  @Column({ type: 'varchar', length: 20 }) level: PermissionLevel;

  /** Motivo del ajuste, para que sea auditable meses después. */
  @Column({ type: 'varchar', length: 300, nullable: true }) reason?: string | null;

  @Column({ name: 'granted_by', type: 'uuid', nullable: true }) grantedBy?: string | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
