import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Acciones abiertas o cerradas por persona (importar, exportar, borrar, enviar).
 *
 * Sólo guarda desviaciones: sin filas, todo sigue funcionando como antes según el nivel de cada
 * módulo. No toca datos existentes.
 */
export class AccionesPorUsuario1789400000000 implements MigrationInterface {
  name = 'AccionesPorUsuario1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_action_overrides')) return;
    await queryRunner.createTable(new Table({
      name: 'user_action_overrides',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'user_id', type: 'varchar', length: '36' },
        { name: 'action', type: 'varchar', length: '60' },
        { name: 'allowed', type: 'tinyint', width: 1 },
        { name: 'reason', type: 'varchar', length: '300', isNullable: true },
        { name: 'granted_by', type: 'varchar', length: '36', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);
    await queryRunner.createIndex('user_action_overrides', new TableIndex({ name: 'UQ_user_action_override', columnNames: ['user_id', 'action'], isUnique: true }));
    await queryRunner.createIndex('user_action_overrides', new TableIndex({ name: 'IDX_user_action_override_org', columnNames: ['organization_id', 'user_id'] }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_action_overrides')) await queryRunner.dropTable('user_action_overrides');
  }
}
