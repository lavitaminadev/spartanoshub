import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Vencimiento de las excepciones de permiso por persona.
 *
 * Una excepción con `expires_at` deja de conceder acceso al pasar esa fecha, sin que nadie
 * tenga que acordarse de retirarla. La fila se conserva para que quede constancia de qué se
 * concedió, a quién y hasta cuándo.
 *
 * Nulo significa sin vencimiento, que es como se comportaban todas las excepciones creadas
 * antes de esta columna.
 */
export class UserPermissionOverrideExpiry1726400100000 implements MigrationInterface {
  name = 'UserPermissionOverrideExpiry1726400100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_permission_overrides'))) return;
    const table = await queryRunner.getTable('user_permission_overrides');
    if (table?.findColumnByName('expires_at')) return;

    await queryRunner.addColumn('user_permission_overrides', new TableColumn({
      name: 'expires_at',
      type: 'timestamp',
      isNullable: true,
    }));

    // El listado de administración separa vigentes de vencidas por esta columna.
    await queryRunner.createIndex('user_permission_overrides', new TableIndex({
      name: 'IDX_user_permission_override_expires',
      columnNames: ['organization_id', 'expires_at'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_permission_overrides'))) return;
    const table = await queryRunner.getTable('user_permission_overrides');
    if (table?.indices.some((index) => index.name === 'IDX_user_permission_override_expires')) {
      await queryRunner.dropIndex('user_permission_overrides', 'IDX_user_permission_override_expires');
    }
    if (table?.findColumnByName('expires_at')) {
      await queryRunner.dropColumn('user_permission_overrides', 'expires_at');
    }
  }
}
