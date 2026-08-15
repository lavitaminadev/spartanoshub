import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Fila de coordinación por cliente y día para crear reservas.
 *
 * Existe para que dos reservas del mismo día no puedan pasarse los topes, y para que las de
 * días distintos no se estorben.
 *
 * Antes se bloqueaba la fila del formulario. Eso tenía dos defectos:
 *
 * 1. **Bloqueaba de más.** Una reserva del lunes esperaba a una del viernes aunque no compitan
 *    por ningún cupo.
 * 2. **Bloqueaba de menos.** El tope diario del cliente suma todos sus formularios, así que dos
 *    formularios de la misma cuenta reservando a la vez bloqueaban filas distintas, ninguno
 *    esperaba al otro, ambos contaban cero y ambos insertaban. El tope se podía exceder.
 *
 * La clave es `(cliente, día)` porque el cliente es el alcance del tope más amplio: cubre
 * también el del formulario —que pertenece a un cliente— y el del turno, que cae dentro del día.
 *
 * La tabla no guarda cuentas: solo existe para tener algo concreto que bloquear. El conteo se
 * sigue haciendo sobre `reservations`, que es la única fuente de verdad. Una fila que se pudiera
 * desincronizar del conteo real sería peor que no tenerla.
 */
export class ReservationDayLocks1726900005000 implements MigrationInterface {
  name = 'ReservationDayLocks1726900005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservation_day_locks')) return;

    await queryRunner.createTable(new Table({
      name: 'reservation_day_locks',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'client_id', type: 'varchar', length: '36' },
        /** Día local del cliente, en formato `AAAA-MM-DD`. No es una marca de tiempo: el tope es por jornada. */
        { name: 'day', type: 'varchar', length: '10' },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    // El índice único es lo que permite crear la fila sin carrera: dos peticiones simultáneas
    // intentan insertarla, una gana y la otra la encuentra, y ambas terminan bloqueando la misma.
    await queryRunner.createIndex('reservation_day_locks', new TableIndex({
      name: 'UQ_reservation_day_lock', columnNames: ['client_id', 'day'], isUnique: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservation_day_locks')) {
      await queryRunner.dropTable('reservation_day_locks');
    }
  }
}
