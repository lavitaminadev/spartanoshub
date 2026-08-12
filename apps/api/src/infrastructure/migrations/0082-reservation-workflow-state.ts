import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Etapa del flujo de producción de una reserva.
 *
 * La bandeja ya ofrece avanzar la reserva por las seis etapas del servicio (borrador → …→
 * entregada), pero no había dónde guardarlas: el estado quedaba sólo en la pantalla y se
 * perdía al recargar. `status` no sirve para esto —describe la asistencia del comensal, no
 * el avance de la producción— así que las dos dimensiones necesitan columnas distintas.
 *
 * Las reservas existentes arrancan en `draft`, que es como la interfaz ya las interpretaba
 * cuando el campo venía ausente.
 */
export class ReservationWorkflowState1726900003000 implements MigrationInterface {
  name = 'ReservationWorkflowState1726900003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('reservations');
    if (!table || table.findColumnByName('workflow_state')) return;
    await queryRunner.addColumn('reservations', new TableColumn({
      name: 'workflow_state', type: 'varchar', length: '20', isNullable: false, default: "'draft'",
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('reservations');
    if (table?.findColumnByName('workflow_state')) await queryRunner.dropColumn('reservations', 'workflow_state');
  }
}
