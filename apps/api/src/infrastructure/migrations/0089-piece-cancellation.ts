import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Constancia de por qué se canceló una pieza y de quién fue la responsabilidad.
 *
 * El motivo ya quedaba en el movimiento de devolución, pero como texto libre: servía para leerlo
 * y no para contarlo. Distinguir una cancelación pedida por el cliente de una causada por un
 * error de producción es lo que después permite revisar un mes y saber si el trabajo perdido fue
 * un cambio de opinión del cliente o algo que la agencia hizo mal.
 *
 * Va en la pieza y no solo en el movimiento porque una pieza puede cancelarse sin haber
 * reservado nada —nunca se asignó— y ese caso también hay que poder contarlo.
 */
export class PieceCancellation1726900009000 implements MigrationInterface {
  name = 'PieceCancellation1726900009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('pieces');
    if (!table) return;

    const columnas = [
      new TableColumn({ name: 'cancel_origin', type: 'varchar', length: '20', isNullable: true }),
      new TableColumn({ name: 'cancel_reason', type: 'varchar', length: '500', isNullable: true }),
      new TableColumn({ name: 'cancelled_at', type: 'timestamp', isNullable: true }),
      new TableColumn({ name: 'cancelled_by', type: 'varchar', length: '36', isNullable: true }),
    ];
    for (const columna of columnas) {
      if (!table.findColumnByName(columna.name)) await queryRunner.addColumn('pieces', columna);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('pieces');
    if (!table) return;
    for (const nombre of ['cancel_origin', 'cancel_reason', 'cancelled_at', 'cancelled_by']) {
      if (table.findColumnByName(nombre)) await queryRunner.dropColumn('pieces', nombre);
    }
  }
}
