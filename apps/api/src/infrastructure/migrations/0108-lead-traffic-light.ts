import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Separa la prioridad manual del puntaje y corrige la semántica de calificación. */
export class LeadTrafficLight1756100000108 implements MigrationInterface {
  name = 'LeadTrafficLight1756100000108';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('leads', 'traffic_light'))) {
      await queryRunner.addColumn('leads', new TableColumn({
        name: 'traffic_light', type: 'varchar', length: '10', isNullable: true,
      }));
    }
    await queryRunner.query("UPDATE leads SET fit_status = 'unqualified' WHERE fit_status = 'discarded'");
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query("UPDATE leads SET fit_status = 'discarded' WHERE fit_status = 'unqualified'");
    if (await queryRunner.hasColumn('leads', 'traffic_light')) {
      await queryRunner.dropColumn('leads', 'traffic_light');
    }
  }
}
