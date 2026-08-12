import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Encuestas propias y sus respuestas.
 *
 * Distintas de la encuesta post-visita de Reservas (`survey_contact_requests`), que sigue
 * siendo parte del circuito de una reserva. Estas viven por su cuenta: se crean, se
 * distribuyen y se cierran sin depender de una visita.
 */
export class Surveys1726400300000 implements MigrationInterface {
  name = 'Surveys1726400300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) {
      await queryRunner.createTable(new Table({
        name: 'surveys',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'varchar', length: '36' },
          { name: 'title', type: 'varchar', length: '200' },
          { name: 'type', type: 'varchar', length: '20' },
          { name: 'questions', type: 'json' },
          { name: 'status', type: 'varchar', length: '20', default: "'draft'" },
          { name: 'created_by', type: 'varchar', length: '36' },
          { name: 'recipients', type: 'json', isNullable: true },
          { name: 'distribution', type: 'json', isNullable: true },
          { name: 'response_count', type: 'int', default: 0 },
          { name: 'design_config', type: 'json', isNullable: true },
          { name: 'google_review', type: 'json', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
        ],
      }), true);

      // El listado siempre filtra por organización y casi siempre por estado.
      await queryRunner.createIndex('surveys', new TableIndex({
        name: 'IDX_survey_org_status',
        columnNames: ['organization_id', 'status'],
      }));
    }

    if (!(await queryRunner.hasTable('survey_responses'))) {
      await queryRunner.createTable(new Table({
        name: 'survey_responses',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
          { name: 'organization_id', type: 'varchar', length: '36' },
          { name: 'survey_id', type: 'varchar', length: '36' },
          { name: 'respondent_id', type: 'varchar', length: '100' },
          { name: 'answers', type: 'json' },
          { name: 'submitted_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }), true);

      // Los resultados se agregan siempre por encuesta.
      await queryRunner.createIndex('survey_responses', new TableIndex({
        name: 'IDX_survey_response_survey',
        columnNames: ['survey_id'],
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('survey_responses')) await queryRunner.dropTable('survey_responses');
    if (await queryRunner.hasTable('surveys')) await queryRunner.dropTable('surveys');
  }
}
