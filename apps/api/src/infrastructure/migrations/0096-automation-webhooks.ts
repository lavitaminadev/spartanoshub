import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Bandeja de salida de los webhooks que envían las automatizaciones.
 *
 * Es la tercera del sistema, junto a las de Meta y Google, y existe por la misma razón: la
 * acción escribe acá y un trabajo aparte hace la llamada, de modo que un destinatario caído o
 * lento no retenga la ejecución ni las demás automatizaciones de la misma tanda.
 *
 * El índice cubre la única consulta que se hace de forma repetida: qué queda por enviar y ya
 * cumplió su espera.
 */
export class AutomationWebhooks1755500300000 implements MigrationInterface {
  name = 'AutomationWebhooks1755500300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('automation_webhook_deliveries')) return;

    await queryRunner.createTable(new Table({
      name: 'automation_webhook_deliveries',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'run_id', type: 'varchar', length: '36', isNullable: true },
        { name: 'url', type: 'varchar', length: '500' },
        { name: 'payload', type: 'json' },
        { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
        { name: 'attempts', type: 'int', default: 0 },
        { name: 'next_attempt_at', type: 'timestamp', isNullable: true },
        { name: 'last_status_code', type: 'int', isNullable: true },
        { name: 'last_error', type: 'text', isNullable: true },
        { name: 'sent_at', type: 'timestamp', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createIndex('automation_webhook_deliveries', new TableIndex({
      name: 'IDX_webhook_deliveries_pending',
      columnNames: ['status', 'next_attempt_at'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('automation_webhook_deliveries')) {
      await queryRunner.dropTable('automation_webhook_deliveries');
    }
  }
}
