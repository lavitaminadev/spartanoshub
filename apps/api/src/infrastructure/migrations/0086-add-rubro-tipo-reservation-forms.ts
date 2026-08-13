import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Rubro y tipo de captación en los formularios de reserva.
 *
 * Espartanos vende planes por rubro (gastronómico, salud, legal, inmobiliario, startups).
 * Cada formulario de reserva se etiqueta con su `rubro` y su `tipo` de captación para
 * agrupar captación y métricas. El rubro del cliente ya vive en `clients.industry`.
 */
export class AddRubroTipoToReservationForms0086 implements MigrationInterface {
  name = 'AddRubroTipoToReservationForms0086';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('reservation_forms', 'rubro'))) {
      await queryRunner.addColumn('reservation_forms', new TableColumn({ name: 'rubro', type: 'varchar', length: '60', isNullable: true }));
    }
    if (!(await queryRunner.hasColumn('reservation_forms', 'tipo'))) {
      await queryRunner.addColumn('reservation_forms', new TableColumn({ name: 'tipo', type: 'varchar', length: '60', isNullable: true }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('reservation_forms', 'rubro')) await queryRunner.dropColumn('reservation_forms', 'rubro');
    if (await queryRunner.hasColumn('reservation_forms', 'tipo')) await queryRunner.dropColumn('reservation_forms', 'tipo');
  }
}
