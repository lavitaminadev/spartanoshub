import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * El cupón que acompaña una campaña.
 *
 * Se guarda el código y no una referencia al cupón: éste puede desactivarse o vencer después, y
 * entonces la campaña ya no diría qué se ofreció ese día. Ante un reclamo hay que poder leerlo.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class CuponEnLaCampana1790000000164 implements MigrationInterface {
  name = 'CuponEnLaCampana1790000000164';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('email_campaigns'))) return;
    if (!(await hayColumna(queryRunner, 'email_campaigns', 'cupon'))) {
      await queryRunner.query('ALTER TABLE email_campaigns ADD COLUMN cupon VARCHAR(40) NULL');
    }
    if (!(await hayColumna(queryRunner, 'email_campaigns', 'cupon_vence'))) {
      await queryRunner.query('ALTER TABLE email_campaigns ADD COLUMN cupon_vence TIMESTAMP NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('email_campaigns'))) return;
    for (const columna of ['cupon_vence', 'cupon']) {
      if (await hayColumna(queryRunner, 'email_campaigns', columna)) {
        await queryRunner.query(`ALTER TABLE email_campaigns DROP COLUMN ${columna}`);
      }
    }
  }
}
