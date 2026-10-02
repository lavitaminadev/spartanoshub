import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Qué cupón se le mandó a esta persona, y no sólo cuándo.
 *
 * `cupon_enviado_en` guardaba la fecha y nada más. Con eso se evitaba repetirle el envío a la
 * misma persona, que era para lo que se hizo, pero no se podía responder la pregunta que de
 * verdad importa: **de los cupones que mandamos por correo, ¿cuántos volvieron?**
 *
 * Sin el código no hay forma de cruzarlo: una reserva trae el cupón con el que vino, pero saber si
 * ese cupón llegó por un correo nuestro o lo vio en un cartel exigía adivinar por fechas.
 *
 * No se rellena hacia atrás. Los envíos anteriores se quedan sin código —constan como enviados y
 * sin atribuir—, porque deducir cuál fue mirando qué cupón tenía el local ese día sería inventar
 * un dato y ensuciaría justamente la medición que esto viene a hacer posible.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class CodigoDelCuponEnviado1790000000170 implements MigrationInterface {
  name = 'CodigoDelCuponEnviado1790000000170';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;
    if (!(await hayColumna(queryRunner, 'reservations', 'cupon_enviado_codigo'))) {
      await queryRunner.query('ALTER TABLE reservations ADD COLUMN cupon_enviado_codigo VARCHAR(40) NULL');
    }
    const indices = await queryRunner.query(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'IDX_reservations_cupon_enviado_codigo'",
    ) as unknown[];
    if (!indices.length) {
      await queryRunner.query('CREATE INDEX IDX_reservations_cupon_enviado_codigo ON reservations (organization_id, cupon_enviado_codigo)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;
    const indices = await queryRunner.query(
      "SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reservations' AND INDEX_NAME = 'IDX_reservations_cupon_enviado_codigo'",
    ) as unknown[];
    if (indices.length) await queryRunner.query('DROP INDEX IDX_reservations_cupon_enviado_codigo ON reservations');
    if (await hayColumna(queryRunner, 'reservations', 'cupon_enviado_codigo')) {
      await queryRunner.query('ALTER TABLE reservations DROP COLUMN cupon_enviado_codigo');
    }
  }
}
