import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * - `reservations.table_label`: la mesa que el anfitrión asigna al recibir. Texto libre y no un
 *   catálogo: cada local numera a su manera, la mesa se decide al llegar y cambia durante el
 *   turno. Es interno: quien reserva no la ve nunca.
 * - `reservations.birth_date`: la fecha de nacimiento cuando el formulario la pide. Guardada en su
 *   propia columna y no dentro de las respuestas, para poder preguntar «quién cumple este mes»
 *   sin recorrer un JSON reserva por reserva.
 *
 * Columnas nuevas y vacías: nada existente cambia.
 */
export class MesaYFechaDeNacimiento1790000000146 implements MigrationInterface {
  name = 'MesaYFechaDeNacimiento1790000000146';

  private readonly columnas = [
    new TableColumn({ name: 'table_label', type: 'varchar', length: '40', isNullable: true }),
    new TableColumn({ name: 'birth_date', type: 'date', isNullable: true }),
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const columna of this.columnas) {
      if (!(await queryRunner.hasColumn('reservations', columna.name))) {
        await queryRunner.addColumn('reservations', columna);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const columna of ['birth_date', 'table_label']) {
      if (await queryRunner.hasColumn('reservations', columna)) await queryRunner.dropColumn('reservations', columna);
    }
  }
}
