import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Por qué se cerró una solicitud de grupo sin reserva.
 *
 * Cerrarlas sólo cambiaba el estado, así que la solicitud salía de la bandeja sin dejar dicho si
 * faltó fecha, si el precio no les cuadró o si nunca contestaron. Son causas que se corrigen de
 * formas distintas y, sin registrarlas, no hay cómo saber cuál está costando más eventos.
 *
 * La categoría es corta a propósito —se cuenta— y la nota queda para lo que no entre en ninguna.
 * Las solicitudes ya cerradas se quedan sin motivo: inventarles uno sería peor que no tenerlo.
 */
export class MotivoDeCierreDeSolicitud1727100000000 implements MigrationInterface {
  name = 'MotivoDeCierreDeSolicitud1727100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_group_requests'))) return;
    const tabla = await queryRunner.getTable('reservation_group_requests');

    if (!tabla?.findColumnByName('close_reason')) {
      await queryRunner.addColumn('reservation_group_requests', new TableColumn({
        name: 'close_reason', type: 'varchar', length: '40', isNullable: true,
      }));
    }
    if (!tabla?.findColumnByName('close_notes')) {
      await queryRunner.addColumn('reservation_group_requests', new TableColumn({
        name: 'close_notes', type: 'text', isNullable: true,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('reservation_group_requests'))) return;
    const tabla = await queryRunner.getTable('reservation_group_requests');
    if (tabla?.findColumnByName('close_notes')) await queryRunner.dropColumn('reservation_group_requests', 'close_notes');
    if (tabla?.findColumnByName('close_reason')) await queryRunner.dropColumn('reservation_group_requests', 'close_reason');
  }
}
