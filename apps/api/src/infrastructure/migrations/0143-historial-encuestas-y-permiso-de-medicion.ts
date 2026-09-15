import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * - `surveys.change_log`: historial visible de ediciones de una encuesta.
 * - `reservations.measurement_consent_version` / `measurement_consent_text`: qué texto de
 *   medición aceptó la persona, para poder demostrarlo (hasta ahora sólo quedaba la fecha).
 *
 * Columnas nuevas y vacías: nada existente cambia.
 */
export class HistorialEncuestasYPermisoDeMedicion1789900000000 implements MigrationInterface {
  name = 'HistorialEncuestasYPermisoDeMedicion1789900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('surveys') && !(await queryRunner.hasColumn('surveys', 'change_log'))) {
      await queryRunner.addColumn('surveys', new TableColumn({ name: 'change_log', type: 'json', isNullable: true }));
    }
    if (!(await queryRunner.hasColumn('reservations', 'measurement_consent_version'))) {
      await queryRunner.addColumn('reservations', new TableColumn({ name: 'measurement_consent_version', type: 'varchar', length: '30', isNullable: true }));
    }
    if (!(await queryRunner.hasColumn('reservations', 'measurement_consent_text'))) {
      await queryRunner.addColumn('reservations', new TableColumn({ name: 'measurement_consent_text', type: 'text', isNullable: true }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const [tabla, columna] of [['reservations', 'measurement_consent_text'], ['reservations', 'measurement_consent_version'], ['surveys', 'change_log']]) {
      if (await queryRunner.hasColumn(tabla, columna)) await queryRunner.dropColumn(tabla, columna);
    }
  }
}
