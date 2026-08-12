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

  @CreateDateColumn({ name: 'submitted_at' }) submittedAt: Date;
}
