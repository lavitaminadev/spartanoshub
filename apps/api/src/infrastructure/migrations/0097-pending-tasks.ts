import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

/**
 * Convierte las solicitudes de aprobación en pendientes con dueño y vencimiento.
 *
 * La tabla ya era polimórfica —`entity_type` + `entity_id`— y ya tenía responsable y fecha de
 * vencimiento. Lo único que faltaba para que sirviera también de tarea era distinguir qué
 * clase de pendiente es cada fila. Crear una tabla paralela habría dejado dos sitios donde
 * mirar para responder «qué tengo pendiente».
 *
 * Aditiva y sin pérdida: las filas que ya existen quedan como `approval`, que es lo que eran
 * cuando se escribieron.
 *
 * Los dos índices cubren las dos consultas que se repiten: lo pendiente de una persona, y lo
 * vencido que el trabajo periódico va a buscar cada hora.
 */
export class PendingTasks1755500400000 implements MigrationInterface {
  name = 'PendingTasks1755500400000';

  private readonly indexes = [
    { name: 'IDX_approval_requests_assignee_open', columnNames: ['assigned_to', 'status', 'due_at'] },
    { name: 'IDX_approval_requests_kind_due', columnNames: ['kind', 'status', 'due_at'] },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('approval_requests');
    if (!table) return;

    if (!table.findColumnByName('kind')) {
      await queryRunner.query(
        "ALTER TABLE `approval_requests` ADD COLUMN `kind` VARCHAR(20) NOT NULL DEFAULT 'approval'",
      );
    }

    for (const index of this.indexes) {
      const existing = await queryRunner.getTable('approval_requests');
      if (existing?.indices.some((item) => item.name === index.name)) continue;
      await queryRunner.createIndex('approval_requests', new TableIndex(index));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('approval_requests');
    if (!table) return;

    for (const index of this.indexes) {
      if (table.indices.some((item) => item.name === index.name)) {
        await queryRunner.dropIndex('approval_requests', index.name);
      }
    }

    // La columna se deja: revertir el código no debería borrar la distinción entre lo que era
    // una aprobación y lo que era una tarea, que no se puede reconstruir.
  }
}
