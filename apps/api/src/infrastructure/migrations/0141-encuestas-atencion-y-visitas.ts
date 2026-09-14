import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

/**
 * Encuestas: seguimiento de respuestas y visitas por canal.
 *
 * - `survey_responses.attended_at` / `attended_by`: cuándo y quién marcó como atendido un mensaje
 *   o una nota baja, para que no se conteste dos veces ni quede sin contestar.
 * - `survey_visits`: una fila por visita a la página pública, con su canal, para saber qué canal
 *   trae gente que responde y cuál no. No guarda datos de la persona.
 *
 * Columnas y tabla nuevas y vacías: no cambia nada de lo existente.
 */
export class EncuestasAtencionYVisitas1789700000000 implements MigrationInterface {
  name = 'EncuestasAtencionYVisitas1789700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('survey_responses', 'attended_at'))) {
      await queryRunner.addColumn('survey_responses', new TableColumn({ name: 'attended_at', type: 'timestamp', isNullable: true }));
    }
    if (!(await queryRunner.hasColumn('survey_responses', 'attended_by'))) {
      await queryRunner.addColumn('survey_responses', new TableColumn({ name: 'attended_by', type: 'varchar', length: '36', isNullable: true }));
    }
    if (!(await queryRunner.hasTable('survey_visits'))) {
      await queryRunner.createTable(new Table({
        name: 'survey_visits',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'varchar', length: '36' },
          { name: 'survey_id', type: 'varchar', length: '36' },
          { name: 'origen', type: 'varchar', length: '60', isNullable: true },
          { name: 'session_id', type: 'varchar', length: '80' },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }));
      // Una visita por sesión: recargar la página no la cuenta dos veces.
      await queryRunner.createIndex('survey_visits', new TableIndex({ name: 'UQ_survey_visit_session', columnNames: ['survey_id', 'session_id'], isUnique: true }));
      await queryRunner.createIndex('survey_visits', new TableIndex({ name: 'IDX_survey_visits_survey_fecha', columnNames: ['survey_id', 'created_at'] }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('survey_visits')) await queryRunner.dropTable('survey_visits');
    for (const nombre of ['attended_by', 'attended_at']) {
      if (await queryRunner.hasColumn('survey_responses', nombre)) await queryRunner.dropColumn('survey_responses', nombre);
    }
  }
}
