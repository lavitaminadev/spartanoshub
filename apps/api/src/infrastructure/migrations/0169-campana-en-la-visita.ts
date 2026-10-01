import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * La campaña de la visita a una encuesta.
 *
 * Los enlaces por canal admiten una campaña —`dia-de-la-madre`— y la pegan a la dirección como
 * `utm_campaign`. En reservas eso se guardaba con cada reserva; en encuestas se perdía: la visita
 * anotaba sólo el canal, así que se podía repartir un QR por campaña y después no había forma de
 * saber cuál había traído a nadie.
 *
 * Se guarda en la visita y no en la respuesta porque la pregunta es «de qué campaña vino esta
 * gente», y la mayoría de quienes llegan no responden: contar sólo las respuestas mediría la
 * campaña por su final y no por lo que trajo.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class CampanaEnLaVisita1790000000169 implements MigrationInterface {
  name = 'CampanaEnLaVisita1790000000169';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('survey_visits'))) return;
    if (!(await hayColumna(queryRunner, 'survey_visits', 'campana'))) {
      await queryRunner.query('ALTER TABLE survey_visits ADD COLUMN campana VARCHAR(60) NULL');
    }
    /*
     * El índice lleva la encuesta delante: la consulta siempre pregunta por una encuesta y agrupa
     * por campaña dentro de ella, nunca por campaña en toda la organización.
     */
    const indices = await queryRunner.query(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'survey_visits' AND INDEX_NAME = 'IDX_survey_visits_survey_campana'",
    ) as unknown[];
    if (!indices.length) {
      await queryRunner.query('CREATE INDEX IDX_survey_visits_survey_campana ON survey_visits (survey_id, campana)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('survey_visits'))) return;
    const indices = await queryRunner.query(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'survey_visits' AND INDEX_NAME = 'IDX_survey_visits_survey_campana'",
    ) as unknown[];
    if (indices.length) await queryRunner.query('DROP INDEX IDX_survey_visits_survey_campana ON survey_visits');
    if (await hayColumna(queryRunner, 'survey_visits', 'campana')) {
      await queryRunner.query('ALTER TABLE survey_visits DROP COLUMN campana');
    }
  }
}
