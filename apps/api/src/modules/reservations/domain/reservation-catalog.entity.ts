import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Catálogo de rubros y tipos de captación por organización.
 *
 * Espartanos vende planes por rubro (gastronómico, salud, legal, inmobiliario, startups).
 * Cada rubro trae sus tipos de captación recomendados, y cada tipo guarda la configuración
 * base (campos con candado, duración, capacidad, CTA y mensaje de confirmación) que el
 * admin puede editar. Sin fila, se usa el catálogo por defecto del sistema.
 */
@Entity('reservation_catalog')
@Index('UQ_reservation_catalog_org', ['organizationId'], { unique: true })
export class ReservationCatalog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid', nullable: true }) organizationId?: string | null;
  @Column({ type: 'json' }) payload: Record<string, unknown>;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
