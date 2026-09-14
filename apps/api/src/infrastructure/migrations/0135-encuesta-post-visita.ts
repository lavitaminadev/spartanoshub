import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lo que hace falta para preguntar después de la visita y saber quién respondió.
 *
 * Hasta acá una respuesta de encuesta se guardaba anónima y de una sola vez: no había forma de
 * saber que la dejó la persona que vino el sábado, ni de guardar la nota antes de que decidiera
 * si contestar el resto. Estas columnas lo permiten sin tocar nada de lo que ya existe.
 *
 * **Todo es aditivo y nulo.** Las respuestas y reservas actuales quedan exactamente como están:
 * reciben NULL en cada columna nueva y ningún valor se reescribe. En MariaDB agregar una columna
 * nula al final no reconstruye la tabla, así que tampoco la bloquea mientras se aplica.
 *
 * - `survey_responses.reservation_id`, `respondent_name`, `respondent_email`: quién fue, cuando la
 *   encuesta llegó por el correo posterior a una reserva. Nulos en las abiertas por enlace o QR.
 * - `rating`: la nota por separado, para listar y filtrar sin abrir el JSON de respuestas.
 * - `team_message`: lo que la persona le quiso decir al equipo en privado.
 * - `completed_at`: si terminó. Una respuesta sin fecha dejó la nota y no siguió.
 * - `edit_token_hash`: permite completar la respuesta propia en pasos sin poder tocar la de otro.
 *   Se guarda sólo el hash; el valor viaja una vez, a quien la creó.
 * - `reservations.post_visit_survey_sent_at`: cada visita se encuesta una sola vez.
 */
export class EncuestaPostVisita1758700000000 implements MigrationInterface {
  name = 'EncuestaPostVisita1758700000000';

  private static readonly COLUMNAS: Array<{ tabla: string; columna: string; tipo: string }> = [
    { tabla: 'survey_responses', columna: 'reservation_id', tipo: 'varchar(36)' },
    { tabla: 'survey_responses', columna: 'respondent_name', tipo: 'varchar(180)' },
    { tabla: 'survey_responses', columna: 'respondent_email', tipo: 'varchar(190)' },
    { tabla: 'survey_responses', columna: 'rating', tipo: 'tinyint' },
    { tabla: 'survey_responses', columna: 'team_message', tipo: 'text' },
    { tabla: 'survey_responses', columna: 'completed_at', tipo: 'timestamp' },
    { tabla: 'survey_responses', columna: 'edit_token_hash', tipo: 'char(64)' },
    { tabla: 'reservations', columna: 'post_visit_survey_sent_at', tipo: 'timestamp' },
  ];

  private async existe(queryRunner: QueryRunner, tabla: string, columna: string): Promise<boolean> {
    const rows = await queryRunner.query(
      'SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
      [tabla, columna],
    );
    return Number(rows?.[0]?.n ?? 0) > 0;
  }

  private async indiceExiste(queryRunner: QueryRunner, tabla: string, indice: string): Promise<boolean> {
    const rows = await queryRunner.query(
      'SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?',
      [tabla, indice],
    );
    return Number(rows?.[0]?.n ?? 0) > 0;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const { tabla, columna, tipo } of EncuestaPostVisita1758700000000.COLUMNAS) {
      if (await this.existe(queryRunner, tabla, columna)) continue;
      await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo} NULL`);
    }
    // El trabajo que envía la encuesta busca visitas ya atendidas y aún no encuestadas.
    if (!(await this.indiceExiste(queryRunner, 'reservations', 'IDX_reservations_post_visit'))) {
      await queryRunner.query('CREATE INDEX IDX_reservations_post_visit ON reservations (status, post_visit_survey_sent_at, ends_at)');
    }
    // Las respuestas de una visita se buscan por su reserva desde la ficha.
    if (!(await this.indiceExiste(queryRunner, 'survey_responses', 'IDX_survey_response_reservation'))) {
      await queryRunner.query('CREATE INDEX IDX_survey_response_reservation ON survey_responses (reservation_id)');
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await this.indiceExiste(queryRunner, 'survey_responses', 'IDX_survey_response_reservation')) {
      await queryRunner.query('DROP INDEX IDX_survey_response_reservation ON survey_responses');
    }
    if (await this.indiceExiste(queryRunner, 'reservations', 'IDX_reservations_post_visit')) {
      await queryRunner.query('DROP INDEX IDX_reservations_post_visit ON reservations');
    }
    for (const { tabla, columna } of EncuestaPostVisita1758700000000.COLUMNAS) {
      if (!(await this.existe(queryRunner, tabla, columna))) continue;
      await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
    }
  }
}
