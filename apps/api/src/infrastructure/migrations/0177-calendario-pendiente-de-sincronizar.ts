import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna, hayIndice } from './helpers/catalogo';

/**
 * Marca de que el calendario del local quedó debiendo un cambio.
 *
 * Mover o cancelar una reserva toca el evento en el Google Calendar del local, fuera de la
 * transacción y sin esperar: que Google no responda no es motivo para devolverle un error a quien
 * acaba de cancelar. Hasta ahora ese fallo era definitivo —quedaba una línea en el registro y
 * nada más—, y el trabajo que recupera integraciones no lo veía, porque busca reservas **sin**
 * `calendar_event_id` y estas sí lo tienen: el evento existe, lo que está mal es su contenido.
 *
 * Se guarda la acción pendiente y no el valor nuevo: el reintento lee la reserva como está en ese
 * momento, de modo que dos cambios seguidos con Google caído terminan aplicando el último.
 *
 * El índice es parcial en la práctica: la inmensa mayoría de las filas tiene `NULL` y el trabajo
 * sólo pregunta por las que no.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class CalendarioPendienteDeSincronizar1790000000177 implements MigrationInterface {
  name = 'CalendarioPendienteDeSincronizar1790000000177';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;
    if (!(await hayColumna(queryRunner, 'reservations', 'calendar_sync_pending'))) {
      await queryRunner.query(
        'ALTER TABLE reservations ADD COLUMN calendar_sync_pending VARCHAR(10) NULL',
      );
    }
    if (!(await hayIndice(queryRunner, 'reservations', 'IDX_reservation_calendar_sync_pending'))) {
      await queryRunner.query(
        'CREATE INDEX IDX_reservation_calendar_sync_pending ON reservations (calendar_sync_pending, updated_at)',
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;
    if (await hayIndice(queryRunner, 'reservations', 'IDX_reservation_calendar_sync_pending')) {
      await queryRunner.query('DROP INDEX IDX_reservation_calendar_sync_pending ON reservations');
    }
    if (await hayColumna(queryRunner, 'reservations', 'calendar_sync_pending')) {
      await queryRunner.query('ALTER TABLE reservations DROP COLUMN calendar_sync_pending');
    }
  }
}
