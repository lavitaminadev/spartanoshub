import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { SurveyDistributionChannel, SurveyQuestion, SurveyStatus, SurveyType } from '@espartanos/shared';

/**
 * Encuesta propia, distinta de la encuesta post-visita que vive dentro de Reservas.
 *
 * Cubre encuestas al equipo (`internal`) y a clientes finales (`customer`): el ciclo —crear,
 * distribuir, cerrar, leer resultados— es el mismo aunque cambie el destinatario.
 *
 * Las preguntas se guardan como JSON y no en su propia tabla: solo se leen y escriben junto
 * con la encuesta, nunca por separado, y normalizarlas obligaría a una unión en cada lectura
 * sin habilitar ninguna consulta que hoy se haga.
 */
@Entity('surveys')
@Index('IDX_survey_org_status', ['organizationId', 'status'])
export class Survey {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', length: 36 }) organizationId: string;

  @Column({ length: 200 }) title: string;

  @Column({ length: 20 }) type: SurveyType;

  @Column({ type: 'json' }) questions: SurveyQuestion[];

  @Column({ length: 20, default: 'draft' }) status: SurveyStatus;

  @Column({ name: 'created_by', length: 36 }) createdBy: string;

  /** Destinatarios explícitos; nulo cuando se distribuye por enlace o QR abierto. */
  @Column({ type: 'json', nullable: true }) recipients?: string[] | null;

  @Column({ type: 'json', nullable: true }) distribution?: SurveyDistributionChannel[] | null;

  /**
   * Conteo de respuestas, mantenido al guardar cada una.
   *
   * Se desnormaliza porque el listado lo muestra en cada fila: contarlo con una agregación
   * por encuesta convertiría una lista de veinte en veintiuna consultas.
   */
  @Column({ name: 'response_count', type: 'int', default: 0 }) responseCount: number;

  @Column({ name: 'design_config', type: 'json', nullable: true }) designConfig?: Record<string, string> | null;

  @Column({ name: 'google_review', type: 'json', nullable: true }) googleReview?: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
