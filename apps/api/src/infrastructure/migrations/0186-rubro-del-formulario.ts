import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * De qué rubro y tipo de captación nació un formulario.
 *
 * Se guarda porque el preset se aplica una vez, al crear, y después el local cambia lo que quiera:
 * sin estas dos columnas no habría forma de saber que un formulario de noventa minutos para cuatro
 * personas es una reserva de mesa, y la pregunta «cuántos formularios de salud tenemos» no tendría
 * dónde mirarse.
 *
 * Quedan nulas en los formularios que ya existen: nacieron antes del catálogo y no se les puede
 * atribuir un rubro sin inventarlo. El catálogo vive en código
 * (`packages/shared/src/catalogo-de-rubros.ts`), así que no hay tabla que crear para él.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class RubroDelFormulario1790000000186 implements MigrationInterface {
  name = 'RubroDelFormulario1790000000186';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_forms'))) return;
    if (!(await hayColumna(queryRunner, 'reservation_forms', 'rubro'))) {
      await queryRunner.query('ALTER TABLE reservation_forms ADD COLUMN rubro VARCHAR(40) NULL');
    }
    if (!(await hayColumna(queryRunner, 'reservation_forms', 'tipo_de_captacion'))) {
      await queryRunner.query('ALTER TABLE reservation_forms ADD COLUMN tipo_de_captacion VARCHAR(40) NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_forms'))) return;
    for (const columna of ['tipo_de_captacion', 'rubro']) {
      if (await hayColumna(queryRunner, 'reservation_forms', columna)) {
        await queryRunner.query(`ALTER TABLE reservation_forms DROP COLUMN ${columna}`);
      }
    }
  }
}
