import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Cuándo ocurrió el lead en su origen, distinto de cuándo entró al sistema.
 *
 * Con una sola fecha, importar un archivo de trescientas filas mete todas como del día de la
 * importación: el gráfico de leads por día muestra un pico falso y el costo por lead de la campaña
 * que los trajo queda repartido en el mes equivocado.
 *
 * **La diferencia entre ambas fechas es el dato auditable.** Un lead que llega por Meta, Zapier o
 * Make debería entrar en segundos; cuando esa brecha empieza a medirse en horas, hay una
 * integración atascada. Con una sola fecha eso es invisible, porque el lead entra con la hora en
 * que el sistema lo recibió y parece puntual.
 *
 * Admite vacío: los leads creados a mano no tienen origen externo, y rellenarlo con la fecha de
 * creación borraría justo la distinción que la columna existe para conservar.
 *
 * El índice va sobre `(organization_id, source_created_at)` porque los informes por período
 * pasarán a preguntar por esta fecha y no por la de ingreso, que es lo que hace que el gráfico
 * refleje cuándo llegó la gente y no cuándo alguien subió el archivo.
 */
export class LeadSourceCreatedAt1756000000000 implements MigrationInterface {
  name = 'LeadSourceCreatedAt1756000000000';

  private static readonly INDEX = 'IDX_leads_org_source_created';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('leads'))) return;

    if (!(await queryRunner.hasColumn('leads', 'source_created_at'))) {
      await queryRunner.addColumn('leads', new TableColumn({
        name: 'source_created_at',
        type: 'datetime',
        isNullable: true,
      }));
    }

    const tabla = await queryRunner.getTable('leads');
    if (!tabla?.indices.some((i) => i.name === LeadSourceCreatedAt1756000000000.INDEX)) {
      await queryRunner.createIndex('leads', new TableIndex({
        name: LeadSourceCreatedAt1756000000000.INDEX,
        columnNames: ['organization_id', 'source_created_at'],
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('leads'))) return;

    const tabla = await queryRunner.getTable('leads');
    if (tabla?.indices.some((i) => i.name === LeadSourceCreatedAt1756000000000.INDEX)) {
      await queryRunner.dropIndex('leads', LeadSourceCreatedAt1756000000000.INDEX);
    }
    if (await queryRunner.hasColumn('leads', 'source_created_at')) {
      await queryRunner.dropColumn('leads', 'source_created_at');
    }
  }
}
