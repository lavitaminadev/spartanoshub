import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Monto estimado del negocio que representa un lead.
 *
 * Sin él, el panel no puede responder nada sobre dinero: monto vendido, ticket promedio, valor
 * del pipeline abierto ni comisión proyectada. Todas esas cifras se calculan sumando montos de
 * leads, y hasta ahora el lead solo sabía de personas y etapas.
 *
 * Admite vacío y no tiene valor por defecto: cero y «todavía no se sabe» son cosas distintas, y
 * rellenar con cero los leads existentes hundiría el ticket promedio con negocios que sí tienen
 * valor pero nadie lo anotó.
 *
 * `decimal` y no `float`: el dinero en coma flotante acumula error al sumarse, y estas columnas
 * se suman por definición.
 */
export class LeadEstimatedAmount1755900000000 implements MigrationInterface {
  name = 'LeadEstimatedAmount1755900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('leads'))) return;
    if (await queryRunner.hasColumn('leads', 'estimated_amount')) return;

    await queryRunner.addColumn('leads', new TableColumn({
      name: 'estimated_amount',
      type: 'decimal',
      precision: 14,
      scale: 2,
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('leads', 'estimated_amount')) {
      await queryRunner.dropColumn('leads', 'estimated_amount');
    }
  }
}
