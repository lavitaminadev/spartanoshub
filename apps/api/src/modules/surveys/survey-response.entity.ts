import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Respuesta de una persona a una encuesta.
 *
 * `respondentId` es el id de usuario en las encuestas internas y un identificador de contacto
 * —o uno anónimo generado al responder— en las de cliente. No se une a `users` con una clave
 * foránea justamente porque en el segundo caso no apunta a una cuenta.
 */
@Entity('survey_responses')
@Index('IDX_survey_response_survey', ['surveyId'])
export class SurveyResponse {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ name: 'organization_id', length: 36 }) organizationId: string;

  @Column({ name: 'survey_id', length: 36 }) surveyId: string;

  @Column({ name: 'respondent_id', length: 100 }) respondentId: string;

  /** Respuesta por id de pregunta: numérica en `nps`/`rating`, texto en el resto. */
  @Column({ type: 'json' }) answers: Record<string, string | number>;

  /** Reserva que originó la invitación. Nulo en las respuestas por enlace o QR abiertos. */
  @Column({ name: 'reservation_id', type: 'varchar', length: 36, nullable: true }) reservationId?: string | null;
  @Column({ name: 'respondent_name', type: 'varchar', length: 180, nullable: true }) respondentName?: string | null;
  @Column({ name: 'respondent_email', type: 'varchar', length: 190, nullable: true }) respondentEmail?: string | null;

  /** La nota por separado: se lista y se filtra sin abrir el JSON. */
  @Column({ name: 'rating', type: 'tinyint', nullable: true }) rating?: number | null;

  /** Lo que la persona quiso decirle al equipo en privado. */
  @Column({ name: 'team_message', type: 'text', nullable: true }) teamMessage?: string | null;

  /** Nulo mientras la respuesta está a medias: dejó la nota y aún no decidió si seguir. */
  @Column({ name: 'completed_at', type: 'timestamp', nullable: true }) completedAt?: Date | null;

  /** Hash del token con que quien la creó puede completarla. El valor nunca se guarda. */
  @Column({ name: 'edit_token_hash', type: 'char', length: 64, nullable: true, select: false }) editTokenHash?: string | null;

  /** Cuándo aceptó el uso de sus datos y el texto exacto, si la encuesta los pidió. */
  @Column({ name: 'privacy_consent_at', type: 'timestamp', nullable: true }) privacyConsentAt?: Date | null;
  @Column({ name: 'privacy_consent_text', type: 'text', nullable: true, select: false }) privacyConsentText?: string | null;

  @CreateDateColumn({ name: 'submitted_at' }) submittedAt: Date;
}
