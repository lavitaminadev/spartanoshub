import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * A quién va cada campaña.
 *
 * Antes siempre era la lista de una empresa. Ahora puede ir también a quienes administran cada
 * empresa —aviso de servicio a quien contrató, no publicidad—.
 *
 * Las campañas que ya existen quedan como `lista`, que es lo que eran. Correrla dos veces no
 * cambia el resultado.
 */
export class DestinoDeLaCampana1790000000165 implements MigrationInterface {
  name = 'DestinoDeLaCampana1790000000165';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('email_campaigns'))) return;
    if (!(await hayColumna(queryRunner, 'email_campaigns', 'destino'))) {
      await queryRunner.query("ALTER TABLE email_campaigns ADD COLUMN destino VARCHAR(20) NOT NULL DEFAULT 'lista'");
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('email_campaigns'))) return;
    for (const columna of ['destino']) {
      if (await hayColumna(queryRunner, 'email_campaigns', columna)) {
        await queryRunner.query(`ALTER TABLE email_campaigns DROP COLUMN ${columna}`);
      }
    }
  }
}
