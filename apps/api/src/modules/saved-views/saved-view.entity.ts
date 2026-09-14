import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Un recorte con nombre de una lista: «Hoy sin confirmar», «Grupos de este mes».
 *
 * Guarda **filtros, no datos**. Aplicar una vista compartida vuelve a pedir la lista con los
 * permisos de quien la abre, así que compartirla nunca le muestra a nadie algo que no podía ver.
 */
@Entity('saved_views')
@Index('IDX_saved_views_org_scope', ['organizationId', 'scope'])
@Index('UQ_saved_views_owner_scope_name', ['ownerUserId', 'scope', 'name'], { unique: true })
export class SavedView {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;

  /** Empresa del portal que la creó. Nulo en las del equipo interno: los dos mundos no se mezclan. */
  @Column({ name: 'client_id', type: 'uuid', nullable: true }) clientId?: string | null;

  @Column({ name: 'owner_user_id', type: 'uuid' }) ownerUserId: string;

  /** Qué lista: `reservas.lista`, `crm.leads.commercial`. Cada una guarda las suyas. */
  @Column({ length: 80 }) scope: string;

  @Column({ length: 60 }) name: string;

  @Column({ type: 'json' }) filters: Record<string, string>;

  /** Si la ve el resto del equipo. Por defecto es de quien la creó. */
  @Column({ type: 'boolean', default: false }) shared: boolean;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
