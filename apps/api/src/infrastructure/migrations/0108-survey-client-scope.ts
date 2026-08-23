import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/** Las encuestas existentes quedan como agencia; las nuevas pueden pertenecer a una empresa. */
export class SurveyClientScope1756000003000 implements MigrationInterface {
  name = 'SurveyClientScope1756000003000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('surveys', 'client_id'))) {
      await queryRunner.addColumn('surveys', new TableColumn({ name: 'client_id', type: 'varchar', length: '36', isNullable: true }));
    }
    const table = await queryRunner.getTable('surveys');
    if (table && !table.indices.some((index) => index.name === 'IDX_survey_org_client')) {
      await queryRunner.createIndex('surveys', new TableIndex({ name: 'IDX_survey_org_client', columnNames: ['organization_id', 'client_id'] }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('surveys');
    if (table?.indices.some((index) => index.name === 'IDX_survey_org_client')) await queryRunner.dropIndex('surveys', 'IDX_survey_org_client');
    if (await queryRunner.hasColumn('surveys', 'client_id')) await queryRunner.dropColumn('surveys', 'client_id');
  }
}
