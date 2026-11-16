import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('monthly_reports')
@Index('UQ_monthly_reports_client_period', ['clientId', 'year', 'month'], { unique: true })
export class MonthlyReport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ type: 'smallint' }) year: number;
  @Column({ type: 'tinyint' }) month: number;
  @Column({ type: 'varchar', length: 255 }) title: string;
  @Column({ type: 'varchar', length: 20, default: 'draft' }) status: string;
  @Column({ name: 'executive_summary', type: 'text', nullable: true }) executiveSummary?: string;
  @Column({ type: 'json' }) metrics: Record<string, number>;
  /**
   * Las mismas métricas del mes anterior, para que el informe compare sin volver a consultar.
   *
   * Se congelan junto a las del período a propósito: un informe publicado en abril debe seguir
   * mostrando en octubre la comparación que mostró el día que se firmó. Calcularla al abrirlo la
   * haría cambiar si los datos de marzo se corrigen después, y entonces el documento entregado y
   * el que se ve dejarían de coincidir.
   *
   * Nula en los informes generados antes de esto: la tarjeta muestra el período sin comparación.
   */
  @Column({ name: 'metrics_previous', type: 'json', nullable: true }) metricsPrevious?: Record<string, number>;
  /** Primer día del período con que se compara, `YYYY-MM-DD`; nulo si no se guardó comparación. */
  @Column({ name: 'previous_period_start', type: 'date', nullable: true }) previousPeriodStart?: string;
  @Column({ type: 'json', nullable: true }) insights?: string[];
  @Column({ type: 'text', nullable: true }) recommendations?: string;
  @Column({ name: 'sales_generated', type: 'decimal', precision: 18, scale: 2, default: 0 }) salesGenerated: number;
  @Column({ name: 'ad_spend', type: 'decimal', precision: 18, scale: 2, default: 0 }) adSpend: number;
  @Column({ type: 'int', default: 0 }) leads: number;
  @Column({ type: 'int', default: 0 }) bookings: number;
  @Column({ type: 'int', default: 0 }) conversions: number;
  @Column({ name: 'created_by', type: 'uuid' }) createdBy: string;
  @Column({ name: 'published_by', type: 'uuid', nullable: true }) publishedBy?: string;
  @Column({ name: 'published_at', type: 'timestamp', nullable: true }) publishedAt?: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
