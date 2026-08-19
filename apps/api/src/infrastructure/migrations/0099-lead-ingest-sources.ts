import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Orígenes de entrada de leads, cada uno con su propia llave.
 *
 * Con una llave compartida, filtrarse obliga a rotarla en todas partes a la vez y a reconfigurar
 * cada integración; con una por origen se revoca la afectada y las demás siguen recibiendo.
 *
 * Se guarda la huella y no la llave, igual que una contraseña: quien lea la base no debe poder
 * usar la integración. El índice único sobre `token_hash` sirve además para buscarla al recibir,
 * que es la consulta de cada lead que entra.
 *
 * `received_count` y `last_received_at` convierten «no me llegan los leads» en un diagnóstico
 * inmediato: se ve cuál conexión está viva y cuál nunca se usó. `last_error` completa el cuadro,
 * porque sin él una integración mal configurada se ve idéntica a una que nadie estrenó.
 */
export class LeadIngestSources1755700000000 implements MigrationInterface {
  name = 'LeadIngestSources1755700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('lead_ingest_sources')) return;

    await queryRunner.createTable(new Table({
      name: 'lead_ingest_sources',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'client_id', type: 'varchar', length: '36', isNullable: true },
        { name: 'name', type: 'varchar', length: '120' },
        { name: 'source', type: 'varchar', length: '60' },
        { name: 'token_hash', type: 'varchar', length: '64' },
        { name: 'token_hint', type: 'varchar', length: '12' },
        { name: 'is_active', type: 'tinyint', width: 1, default: 1 },
        { name: 'received_count', type: 'int', default: 0 },
        { name: 'last_received_at', type: 'datetime', isNullable: true },
        { name: 'last_error', type: 'varchar', length: '300', isNullable: true },
        { name: 'last_error_at', type: 'datetime', isNullable: true },
        { name: 'created_by', type: 'varchar', length: '36', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    await queryRunner.createIndex('lead_ingest_sources', new TableIndex({
      name: 'UQ_lead_ingest_sources_token',
      columnNames: ['token_hash'],
      isUnique: true,
    }));

    await queryRunner.createIndex('lead_ingest_sources', new TableIndex({
      name: 'IDX_lead_ingest_sources_org',
      columnNames: ['organization_id', 'is_active'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('lead_ingest_sources')) {
      await queryRunner.dropTable('lead_ingest_sources');
    }
  }
}
