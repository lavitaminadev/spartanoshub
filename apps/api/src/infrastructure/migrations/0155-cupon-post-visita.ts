import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna, hayIndice } from './helpers/catalogo';

/**
 * Cuándo se le envió el cupón a quien vino.
 *
 * Va en la reserva y no en el contacto porque el cupón se gana por visita: la misma persona que
 * viene a dos locales distintos puede recibir el de cada uno, y quien vino dos veces al mismo
 * recibe uno solo. Guardarlo por persona borraría esa distinción.
 *
 * La columna se marca también cuando se decide **no** enviarlo —porque ya recibió uno hace
 * poco—: sin eso, esa reserva se volvería a revisar en cada pasada del trabajo hasta envejecer.
 */
export class CuponPostVisita1790000000155 implements MigrationInterface {
  name = 'CuponPostVisita1790000000155';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;

    if (!(await hayColumna(queryRunner, 'reservations', 'cupon_enviado_en'))) {
      await queryRunner.query('ALTER TABLE reservations ADD COLUMN cupon_enviado_en TIMESTAMP NULL');
    }

    /*
     * El índice que usa el trabajo, en el orden en que pregunta.
     *
     * Busca las visitas marcadas como asistidas, dentro de una ventana de días, a las que
     * todavía no se les envió nada. Sin él, cada pasada recorre la tabla entera de reservas, que
     * es la que más crece de todo el sistema.
     */
    if (!(await hayIndice(queryRunner, 'reservations', 'IDX_reservations_cupon_pendiente'))) {
      await queryRunner.query('CREATE INDEX IDX_reservations_cupon_pendiente ON reservations (status, cupon_enviado_en, ends_at)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;
    if (await hayIndice(queryRunner, 'reservations', 'IDX_reservations_cupon_pendiente')) {
      await queryRunner.query('DROP INDEX IDX_reservations_cupon_pendiente ON reservations');
    }
    if (await hayColumna(queryRunner, 'reservations', 'cupon_enviado_en')) {
      await queryRunner.query('ALTER TABLE reservations DROP COLUMN cupon_enviado_en');
    }
  }
}
