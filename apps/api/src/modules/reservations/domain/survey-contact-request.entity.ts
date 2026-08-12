import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Petición de que el equipo contacte a quien respondió una encuesta con calificación baja.
 *
 * Vive en su propia tabla y no en la respuesta porque tiene ciclo propio —pendiente,
 * contactada, resuelta— y lo gestiona el equipo, no quien respondió. La respuesta original
 * queda inmutable, que es lo que permite comparar después qué se hizo con cada reclamo.
 */
@Entity('survey_contact_requests')
@Index('IDX_survey_contact_requests_form', ['formId', 'createdAt'])
@Index('UQ_survey_contact_requests_response', ['responseId'], { unique: true })
export class SurveyContactRequest {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'organization_id', type: 'uuid' }) organizationId: string;
  @Column({ name: 'client_id', type: 'uuid' }) clientId: string;
  @Column({ name: 'form_id', type: 'uuid' }) formId: string;
  /** Respuesta de encuesta (`reservation_form_events`) que originó la solicitud. */
  @Column({ name: 'response_id', type: 'uuid' }) responseId: string;
  @Column({ name: 'guest_name', type: 'varchar', length: 180, nullable: true }) guestName?: string | null;
  @Column({ type: 'varchar', length: 190, nullable: true }) email?: string | null;
  @Column({ type: 'varchar', length: 50, nullable: true }) phone?: string | null;
  @Column({ type: 'text', nullable: true }) message?: string | null;
  /** Calificación que disparó la solicitud, para priorizar sin abrir la respuesta completa. */
  @Column({ type: 'smallint', nullable: true }) rating?: number | null;
  @Column({ type: 'varchar', length: 20, default: 'pending' }) status: string;
  @Column({ type: 'text', nullable: true }) notes?: string | null;
  @Column({ name: 'resolved_by', type: 'uuid', nullable: true }) resolvedBy?: string | null;
  @Column({ name: 'resolved_at', type: 'timestamp', nullable: true }) resolvedAt?: Date | null;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}
