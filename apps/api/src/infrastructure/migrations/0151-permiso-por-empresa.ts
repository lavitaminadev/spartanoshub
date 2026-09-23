import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * De qué empresa es cada excepción de permiso.
 *
 * Una excepción decía persona, módulo y nivel, y valía en todas las empresas por igual. Con eso
 * no se puede decir «en esta empresa administra Reservas y en esta otra sólo mira», que es como
 * trabaja quien atiende a más de una.
 *
 * `client_id` vacío significa «en todas las empresas», que es exactamente lo que hacían las
 * excepciones existentes: por eso no hay que convertir nada y nadie cambia de permisos con esta
 * migración. Una excepción de una empresa manda sobre la general cuando se está mirando esa
 * empresa.
 *
 * La clave única pasa a incluir la empresa: sin eso, dar un permiso distinto en dos empresas
 * chocaría contra el índice anterior y se rechazaría como duplicado.
 */
export class PermisoPorEmpresa1790000000151 implements MigrationInterface {
  name = 'PermisoPorEmpresa1790000000151';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_permission_overrides'))) return;
    const tabla = await queryRunner.getTable('user_permission_overrides');

    if (!tabla?.findColumnByName('client_id')) {
      await queryRunner.addColumn('user_permission_overrides', new TableColumn({ name: 'client_id', type: 'varchar', length: '36', isNullable: true }));
    }

    /*
     * MySQL trata cada NULL como distinto, así que una única con `client_id` no impediría dos
     * excepciones generales del mismo módulo. La columna espejo guarda un texto fijo cuando no
     * hay empresa, y es la que entra en la clave: así «general» sigue siendo una sola fila.
     */
    if (!tabla?.findColumnByName('client_scope')) {
      await queryRunner.query('ALTER TABLE user_permission_overrides ADD COLUMN client_scope VARCHAR(36) AS (COALESCE(client_id, \'*\')) STORED');
    }

    const indices = (await queryRunner.getTable('user_permission_overrides'))?.indices ?? [];
    if (indices.some((indice) => indice.name === 'UQ_user_permission_override')) {
      await queryRunner.query('DROP INDEX UQ_user_permission_override ON user_permission_overrides');
    }
    if (!indices.some((indice) => indice.name === 'UQ_user_permission_override_client')) {
      await queryRunner.query('CREATE UNIQUE INDEX UQ_user_permission_override_client ON user_permission_overrides (user_id, module, client_scope)');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_permission_overrides'))) return;
    const tabla = await queryRunner.getTable('user_permission_overrides');
    const indices = tabla?.indices ?? [];
    if (indices.some((indice) => indice.name === 'UQ_user_permission_override_client')) {
      await queryRunner.query('DROP INDEX UQ_user_permission_override_client ON user_permission_overrides');
    }
    // Las excepciones de una empresa concreta se pierden al volver: antes no cabían.
    await queryRunner.query('DELETE FROM user_permission_overrides WHERE client_id IS NOT NULL');
    if (tabla?.findColumnByName('client_scope')) await queryRunner.query('ALTER TABLE user_permission_overrides DROP COLUMN client_scope');
    if (tabla?.findColumnByName('client_id')) await queryRunner.dropColumn('user_permission_overrides', 'client_id');
    await queryRunner.query('CREATE UNIQUE INDEX UQ_user_permission_override ON user_permission_overrides (user_id, module)');
  }
}
