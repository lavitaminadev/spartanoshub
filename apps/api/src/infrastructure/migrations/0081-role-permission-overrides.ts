import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Ajustes de la matriz de cargos, guardados por diferencias.
 *
 * La matriz base sigue viviendo en `role-permissions.ts`. Esta tabla guarda únicamente las
 * celdas que una organización decidió mover respecto de ese código, igual que
 * `user_permission_overrides` hace a nivel de persona.
 *
 * Guardar la matriz completa obligaría a que cada módulo nuevo del catálogo naciera ausente
 * de la copia en base de datos y quedara invisible sin causa aparente. Con diferencias, un
 * módulo nuevo se resuelve por código hasta que alguien decida lo contrario.
 */
export class RolePermissionOverrides1726400000000 implements MigrationInterface {
  name = 'RolePermissionOverrides1726400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('role_permission_overrides')) return;

    await queryRunner.createTable(new Table({
      name: 'role_permission_overrides',
      columns: [
        { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'organization_id', type: 'varchar', length: '36' },
        { name: 'role', type: 'varchar', length: '40' },
        { name: 'module', type: 'varchar', length: '60' },
        { name: 'level', type: 'varchar', length: '20' },
        { name: 'reason', type: 'varchar', length: '300', isNullable: true },
        { name: 'granted_by', type: 'varchar', length: '36', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
        { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
      ],
    }), true);

    // Un solo ajuste por organización, cargo y módulo: dos filas para la misma celda harían
    // que el nivel efectivo dependiera del orden de lectura.
    await queryRunner.createIndex('role_permission_overrides', new TableIndex({
      name: 'UQ_role_permission_override',
      columnNames: ['organization_id', 'role', 'module'],
      isUnique: true,
    }));

    // El acceso caliente: la resolución de permisos carga todos los ajustes de la
    // organización de una vez y los memoriza.
    await queryRunner.createIndex('role_permission_overrides', new TableIndex({
      name: 'IDX_role_permission_override_org',
      columnNames: ['organization_id'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('role_permission_overrides'))) return;
    await queryRunner.dropTable('role_permission_overrides');
  }
}
