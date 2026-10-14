import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayIndice } from './helpers/catalogo';

/**
 * Índice para leer las respuestas de una encuesta por período.
 *
 * El único índice que había era `IDX_survey_response_survey`, sobre `survey_id` a secas: servía
 * cuando los resultados se traían completos y se agregaban en memoria. Al poder pedir un tramo de
 * fechas, el motor tenía que leer todas las filas de la encuesta y descartar las de fuera, además
 * de ordenarlas aparte.
 *
 * Con `submitted_at` como segunda columna el rango se recorre directo y el orden por fecha —que es
 * como se lee la lista— sale del propio índice.
 *
 * El índice viejo queda redundante: `survey_id` es el prefijo de este, así que cualquier consulta
 * y la llave foránea pueden usar el nuevo. Se intenta quitarlo para no pagar su escritura en cada
 * respuesta, pero si el motor lo rechaza la migración sigue: tener dos índices es un costo, no una
 * falla.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class RespuestasPorPeriodo1790000000176 implements MigrationInterface {
  name = 'RespuestasPorPeriodo1790000000176';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('survey_responses'))) return;
    if (!(await hayIndice(queryRunner, 'survey_responses', 'IDX_survey_response_survey_fecha'))) {
      await queryRunner.query(
        'CREATE INDEX IDX_survey_response_survey_fecha ON survey_responses (survey_id, submitted_at)',
      );
    }
    if (await hayIndice(queryRunner, 'survey_responses', 'IDX_survey_response_survey')) {
      await queryRunner
        .query('DROP INDEX IDX_survey_response_survey ON survey_responses')
        .catch(() => undefined);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('survey_responses'))) return;
    if (!(await hayIndice(queryRunner, 'survey_responses', 'IDX_survey_response_survey'))) {
      await queryRunner.query('CREATE INDEX IDX_survey_response_survey ON survey_responses (survey_id)');
    }
    if (await hayIndice(queryRunner, 'survey_responses', 'IDX_survey_response_survey_fecha')) {
      await queryRunner.query('DROP INDEX IDX_survey_response_survey_fecha ON survey_responses');
    }
  }
}
