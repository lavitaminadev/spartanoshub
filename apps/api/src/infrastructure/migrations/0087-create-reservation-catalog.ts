import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Catálogo de rubros y tipos de captación de reservas por organización.
 */
export class CreateReservationCatalog0087 implements MigrationInterface {
  name = 'CreateReservationCatalog0087';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservation_catalog')) return;
    await queryRunner.createTable(
      new Table({
        name: 'reservation_catalog',
        columns: [
          { name: 'id', type: 'varchar', length: '36', isPrimary: true },
          { name: 'organization_id', type: 'varchar', length: '36', isNullable: true },
          { name: 'payload', type: 'json' },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'reservation_catalog',
      new TableIndex({ name: 'UQ_reservation_catalog_org', columnNames: ['organization_id'], isUnique: true }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('reservation_catalog')) await queryRunner.dropTable('reservation_catalog');
  }
}
