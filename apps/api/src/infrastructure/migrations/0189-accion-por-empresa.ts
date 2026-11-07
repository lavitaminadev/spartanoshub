import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna, hayIndice } from './helpers/catalogo';

/**
 * De qué empresa es cada ajuste de acción.
 *
 * El nivel de un módulo ya se guarda por empresa desde la 0151. Las acciones finas —las que
 * conceden o niegan un gesto concreto dentro de un módulo— no: su clave era persona y acción, de
 * modo que un ajuste valía en **todas** las empresas que esa persona atiende. La pantalla, en
 * cambio, ofrecía elegir la empresa y mostraba el ajuste bajo la elegida: conceder una acción en
 * un local la concedía en todos, y nada lo decía.
 *
 * `client_id` vacío sigue significando «en todas sus empresas», que es exactamente lo que hacían
 * los ajustes existentes. **Por eso no se convierte ninguna fila y nadie cambia de accesos con
 * esta migración**, que es lo que permite desplegarla sin revisar antes cada caso. Acotar un
 * ajuste general a una empresa se hace desde la pantalla, viendo de quién es y qué empresas
 * alcanza: es la decisión que un `UPDATE` a ciegas no puede tomar, porque el equipo interno no
 * tiene empresa propia, una cuenta de portal puede alcanzar varias, y la empresa escrita en la
 * cuenta puede estar pausada.
 *
 * La columna espejo es la misma solución que la 0151: MySQL trata cada NULL como distinto, así
 * que una única sobre `client_id` no impediría dos ajustes generales de la misma acción.
 */
export class AccionPorEmpresa1790000000189 implements MigrationInterface {
  name = 'AccionPorEmpresa1790000000189';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_action_overrides'))) return;

    if (!(await hayColumna(queryRunner, 'user_action_overrides', 'client_id'))) {
      await queryRunner.query('ALTER TABLE user_action_overrides ADD COLUMN client_id VARCHAR(36) NULL');
    }

    if (!(await hayColumna(queryRunner, 'user_action_overrides', 'client_scope'))) {
      await queryRunner.query('ALTER TABLE user_action_overrides ADD COLUMN client_scope VARCHAR(36) AS (COALESCE(client_id, \'*\')) STORED');
    }

    // La nueva antes que el retiro de la vieja: `user_id` encabeza las dos, así que InnoDB tiene
    // dónde sostener la clave foránea cuando la anterior se va.
    if (!(await hayIndice(queryRunner, 'user_action_overrides', 'UQ_user_action_override_client'))) {
      await queryRunner.query('CREATE UNIQUE INDEX UQ_user_action_override_client ON user_action_overrides (user_id, action, client_scope)');
    }
    if (await hayIndice(queryRunner, 'user_action_overrides', 'UQ_user_action_override')) {
      await queryRunner.query('DROP INDEX UQ_user_action_override ON user_action_overrides');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_action_overrides'))) return;
    // Los ajustes de una empresa concreta se pierden al volver: antes no cabían.
    await queryRunner.query('DELETE FROM user_action_overrides WHERE client_id IS NOT NULL');
    if (!(await hayIndice(queryRunner, 'user_action_overrides', 'UQ_user_action_override'))) {
      await queryRunner.query('CREATE UNIQUE INDEX UQ_user_action_override ON user_action_overrides (user_id, action)');
    }
    if (await hayIndice(queryRunner, 'user_action_overrides', 'UQ_user_action_override_client')) {
      await queryRunner.query('DROP INDEX UQ_user_action_override_client ON user_action_overrides');
    }
    if (await hayColumna(queryRunner, 'user_action_overrides', 'client_scope')) {
      await queryRunner.query('ALTER TABLE user_action_overrides DROP COLUMN client_scope');
    }
    if (await hayColumna(queryRunner, 'user_action_overrides', 'client_id')) {
      await queryRunner.query('ALTER TABLE user_action_overrides DROP COLUMN client_id');
    }
  }
}
