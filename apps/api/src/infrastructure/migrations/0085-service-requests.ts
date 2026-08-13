import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Solicitudes públicas (login → "Solicitudes"): creación de cuenta, alta de empresa,
 * rectificación, anonimización, portabilidad, baja y soporte.
 */
export class CreateServiceRequests0085 implements MigrationInterface {
  name = 'CreateServiceRequests0085';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('service_requests')) return;
    await queryRunner.createTable(
      new Table({
        name: 'service_requests',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'organization_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'type', type: 'varchar', length: '40' },
          { name: 'status', type: 'varchar', length: '20', default: "'received'" },
          { name: 'requester_name', type: 'varchar', length: '180' },
          { name: 'requester_email', type: 'varchar', length: '190' },
          { name: 'requester_rut', type: 'varchar', length: '20', isNullable: true },
          { name: 'requester_phone', type: 'varchar', length: '50', isNullable: true },
          { name: 'message', type: 'text', isNullable: true },
          { name: 'extra', type: 'json', isNullable: true },
          { name: 'resolution_note', type: 'text', isNullable: true },
          { name: 'resolved_by', type: 'varchar', length: '36', isNullable: true },
          { name: 'resolved_at', type: 'timestamp', isNullable: true },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'service_requests',
      new TableIndex({ name: 'IDX_service_requests_org_created', columnNames: ['organization_id', 'created_at'] }),
    );
    await queryRunner.createIndex(
      'service_requests',
      new TableIndex({ name: 'IDX_service_requests_email', columnNames: ['requester_email'] }),
    );
    await queryRunner.createIndex(
      'service_requests',
      new TableIndex({ name: 'IDX_service_requests_status', columnNames: ['status'] }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('service_requests')) await queryRunner.dropTable('service_requests');
  }
}
