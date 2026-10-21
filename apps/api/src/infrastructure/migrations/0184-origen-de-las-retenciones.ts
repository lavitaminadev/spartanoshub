import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Quién retiene cada cupo público.
 *
 * `reservation_holds.origin_key` guarda una huella del origen de la petición —no la dirección—, que
 * es lo único que permite poner un tope a las retenciones vigentes de un mismo origen. Las filas
 * existentes quedan sin huella: ya caducaron o caducan en minutos.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class OrigenDeLasRetenciones1790000000184 implements MigrationInterface {
  name = 'OrigenDeLasRetenciones1790000000184';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_holds'))) return;
    if (!(await hayColumna(queryRunner, 'reservation_holds', 'origin_key'))) {
      await queryRunner.query('ALTER TABLE reservation_holds ADD COLUMN origin_key VARCHAR(64) NULL');
      await queryRunner.query('CREATE INDEX IDX_reservation_hold_origin ON reservation_holds (form_id, origin_key, expires_at)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_holds'))) return;
    if (await hayColumna(queryRunner, 'reservation_holds', 'origin_key')) {
      await queryRunner.query('DROP INDEX IDX_reservation_hold_origin ON reservation_holds');
      await queryRunner.query('ALTER TABLE reservation_holds DROP COLUMN origin_key');
    }
  }
}
