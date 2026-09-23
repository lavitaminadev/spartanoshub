import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna, hayIndice } from './helpers/catalogo';

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

    if (!(await hayColumna(queryRunner, 'user_permission_overrides', 'client_id'))) {
      await queryRunner.query('ALTER TABLE user_permission_overrides ADD COLUMN client_id VARCHAR(36) NULL');
    }

    /*
     * MySQL trata cada NULL como distinto, así que una única con `client_id` no impediría dos
     * excepciones generales del mismo módulo. La columna espejo guarda un texto fijo cuando no
     * hay empresa, y es la que entra en la clave: así «general» sigue siendo una sola fila.
     */
    if (!(await hayColumna(queryRunner, 'user_permission_overrides', 'client_scope'))) {
      await queryRunner.query('ALTER TABLE user_permission_overrides ADD COLUMN client_scope VARCHAR(36) AS (COALESCE(client_id, \'*\')) STORED');
    }

    // La nueva antes que el retiro de la vieja: `user_id` encabeza las dos, así que InnoDB tiene
    // dónde sostener la clave foránea cuando la anterior se va.
    if (!(await hayIndice(queryRunner, 'user_permission_overrides', 'UQ_user_permission_override_client'))) {
      await queryRunner.query('CREATE UNIQUE INDEX UQ_user_permission_override_client ON user_permission_overrides (user_id, module, client_scope)');
    }
    if (await hayIndice(queryRunner, 'user_permission_overrides', 'UQ_user_permission_override')) {
      await queryRunner.query('DROP INDEX UQ_user_permission_override ON user_permission_overrides');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_permission_overrides'))) return;
    // Las excepciones de una empresa concreta se pierden al volver: antes no cabían.
    await queryRunner.query('DELETE FROM user_permission_overrides WHERE client_id IS NOT NULL');
    if (!(await hayIndice(queryRunner, 'user_permission_overrides', 'UQ_user_permission_override'))) {
      await queryRunner.query('CREATE UNIQUE INDEX UQ_user_permission_override ON user_permission_overrides (user_id, module)');
    }
    if (await hayIndice(queryRunner, 'user_permission_overrides', 'UQ_user_permission_override_client')) {
      await queryRunner.query('DROP INDEX UQ_user_permission_override_client ON user_permission_overrides');
    }
    if (await hayColumna(queryRunner, 'user_permission_overrides', 'client_scope')) {
      await queryRunner.query('ALTER TABLE user_permission_overrides DROP COLUMN client_scope');
    }
    if (await hayColumna(queryRunner, 'user_permission_overrides', 'client_id')) {
      await queryRunner.query('ALTER TABLE user_permission_overrides DROP COLUMN client_id');
    }
  }
}
