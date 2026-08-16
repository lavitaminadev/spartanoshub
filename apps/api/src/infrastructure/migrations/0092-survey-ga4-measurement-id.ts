import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * GA4 propio para encuestas públicas.
 *
 * La medición de encuestas queda separada de Reservas: no usa Meta CAPI/Pixel y guarda solo
 * el ID de GA4 que carga la página pública `/survey/:id`.
 */
export class SurveyGa4MeasurementId1726401200000 implements MigrationInterface {
  name = 'SurveyGa4MeasurementId1726401200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) return;
    if (await queryRunner.hasColumn('surveys', 'ga4_measurement_id')) return;
    await queryRunner.addColumn('surveys', new TableColumn({
      name: 'ga4_measurement_id',
      type: 'varchar',
      length: '40',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('surveys'))) return;
    if (!(await queryRunner.hasColumn('surveys', 'ga4_measurement_id'))) return;
    await queryRunner.dropColumn('surveys', 'ga4_measurement_id');
  }
}
