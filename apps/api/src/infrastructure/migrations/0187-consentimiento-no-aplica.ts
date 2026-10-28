import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Un formulario que no le pide aceptación al comensal, y por qué.
 *
 * La aceptación de tratamiento de datos es obligatoria en toda página de reserva, y lo seguirá
 * siendo: estas dos columnas no la quitan, declaran la excepción. `motivo_sin_consentimiento` va
 * junto a la marca a propósito —una excepción sin motivo no se distingue de un olvido, y es
 * justamente esa diferencia la que hay que poder mostrar el día que alguien pregunte—.
 *
 * Las reservas que se tomen bajo un formulario así guardan ese motivo en el texto del
 * consentimiento, de modo que la evidencia dice «no se pidió, por esto» en lugar de quedar vacía.
 *
 * Nulas y en falso para todo lo que ya existe: ningún formulario cambia de comportamiento.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class ConsentimientoNoAplica1790000000187 implements MigrationInterface {
  name = 'ConsentimientoNoAplica1790000000187';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_forms'))) return;
    if (!(await hayColumna(queryRunner, 'reservation_forms', 'consentimiento_no_aplica'))) {
      await queryRunner.query('ALTER TABLE reservation_forms ADD COLUMN consentimiento_no_aplica TINYINT(1) NOT NULL DEFAULT 0');
    }
    if (!(await hayColumna(queryRunner, 'reservation_forms', 'motivo_sin_consentimiento'))) {
      await queryRunner.query('ALTER TABLE reservation_forms ADD COLUMN motivo_sin_consentimiento VARCHAR(300) NULL');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_forms'))) return;
    for (const columna of ['motivo_sin_consentimiento', 'consentimiento_no_aplica']) {
      if (await hayColumna(queryRunner, 'reservation_forms', columna)) {
        await queryRunner.query(`ALTER TABLE reservation_forms DROP COLUMN ${columna}`);
      }
    }
  }
}
