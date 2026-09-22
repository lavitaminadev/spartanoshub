import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Cuándo se fue quien reservó, y quién lo registró.
 *
 * La duración de una reserva era siempre la configurada: el cupo se liberaba a esa hora aunque la
 * mesa llevara rato vacía o siguiera ocupada. Con la salida registrada, el cupo sigue a lo que
 * pasa en el local.
 *
 * El origen distingue una salida que el equipo vio (`team`) de una que el sistema cerró al terminar
 * el horario (`local_closed`): la segunda es un tope, no la hora real, y no entra en el promedio de
 * duración de las visitas. Las reservas anteriores quedan sin salida: no se sabe cuándo se fueron.
 */
export class SalidaDeLaReserva1790000000149 implements MigrationInterface {
  name = 'SalidaDeLaReserva1790000000149';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;
    const tabla = await queryRunner.getTable('reservations');
    if (!tabla?.findColumnByName('left_at')) {
      await queryRunner.addColumn('reservations', new TableColumn({ name: 'left_at', type: 'timestamp', isNullable: true }));
    }
    if (!tabla?.findColumnByName('departure_source')) {
      await queryRunner.addColumn('reservations', new TableColumn({ name: 'departure_source', type: 'varchar', length: '20', isNullable: true }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservations'))) return;
    const tabla = await queryRunner.getTable('reservations');
    if (tabla?.findColumnByName('departure_source')) await queryRunner.dropColumn('reservations', 'departure_source');
    if (tabla?.findColumnByName('left_at')) await queryRunner.dropColumn('reservations', 'left_at');
  }
}
