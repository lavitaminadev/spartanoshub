import { MigrationInterface, QueryRunner } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Los perfiles de cada empresa, a quién se asignan y las invitaciones al equipo.
 *
 * Sin llaves foráneas hacia `users` en las columnas de autoría: borrar a quien invitó no debe
 * arrastrar el registro de que la invitación existió. Las de empresa y perfil sí cascadean,
 * porque sin ellas la fila no significa nada.
 *
 * Correrla dos veces no cambia el resultado.
 */
export class PerfilesPorEmpresaEInvitaciones1790000000182 implements MigrationInterface {
  name = 'PerfilesPorEmpresaEInvitaciones1790000000182';

  public async up(queryRunner: QueryRunner): Promise<void> {
    /*
     * La pertenencia a una empresa se retira marcándola, no borrándola.
     *
     * Las filas existentes quedan activas (sin fecha de retiro).
     */
    if (await queryRunner.hasTable('user_client_access')) {
      const columnas: Array<[string, string]> = [
        ['retired_at', 'TIMESTAMP NULL'],
        ['retired_by', 'CHAR(36) NULL'],
        ['retired_reason', 'VARCHAR(300) NULL'],
        ['retired_outcome', 'VARCHAR(10) NULL'],
        ['reentered_at', 'TIMESTAMP NULL'],
        ['reentered_by', 'CHAR(36) NULL'],
        ['reentry_reason', 'VARCHAR(300) NULL'],
        ['previous_retired_at', 'TIMESTAMP NULL'],
      ];
      for (const [nombre, tipo] of columnas) {
        if (!(await hayColumna(queryRunner, 'user_client_access', nombre))) {
          await queryRunner.query(`ALTER TABLE user_client_access ADD COLUMN ${nombre} ${tipo}`);
        }
      }
    }
    if (!(await queryRunner.hasTable('perfiles'))) {
      await queryRunner.query(`CREATE TABLE perfiles (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NOT NULL,
        name VARCHAR(80) NOT NULL,
        description VARCHAR(300) NULL,
        areas JSON NOT NULL,
        protected_data JSON NOT NULL,
        created_by CHAR(36) NULL,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY UQ_perfil_empresa_nombre (client_id, name),
        CONSTRAINT FK_perfiles_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
      )`);
    }
    if (!(await queryRunner.hasTable('perfil_asignaciones'))) {
      await queryRunner.query(`CREATE TABLE perfil_asignaciones (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NOT NULL,
        user_id CHAR(36) NOT NULL,
        perfil_id CHAR(36) NOT NULL,
        assigned_by CHAR(36) NULL,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY UQ_perfil_asignacion (client_id, user_id),
        KEY IDX_perfil_asignacion_perfil (perfil_id),
        CONSTRAINT FK_perfil_asignacion_perfil FOREIGN KEY (perfil_id) REFERENCES perfiles (id) ON DELETE CASCADE,
        CONSTRAINT FK_perfil_asignacion_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )`);
    }
    if (!(await queryRunner.hasTable('invitaciones_equipo'))) {
      await queryRunner.query(`CREATE TABLE invitaciones_equipo (
        id CHAR(36) NOT NULL PRIMARY KEY,
        organization_id CHAR(36) NOT NULL,
        client_id CHAR(36) NOT NULL,
        email VARCHAR(255) NOT NULL,
        perfil_id CHAR(36) NOT NULL,
        token_hash VARCHAR(64) NOT NULL,
        invited_by CHAR(36) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        accepted_at TIMESTAMP NULL,
        revoked_at TIMESTAMP NULL,
        lifts_ban TINYINT(1) NOT NULL DEFAULT 0,
        reentry_reason VARCHAR(300) NULL,
        created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE KEY UQ_invitacion_token (token_hash),
        KEY IDX_invitacion_empresa_correo (client_id, email),
        CONSTRAINT FK_invitacion_client FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE,
        CONSTRAINT FK_invitacion_perfil FOREIGN KEY (perfil_id) REFERENCES perfiles (id) ON DELETE CASCADE
      )`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_client_access')) {
      for (const nombre of ['previous_retired_at', 'reentry_reason', 'reentered_by', 'reentered_at', 'retired_outcome', 'retired_reason', 'retired_by', 'retired_at']) {
        if (await hayColumna(queryRunner, 'user_client_access', nombre)) await queryRunner.query(`ALTER TABLE user_client_access DROP COLUMN ${nombre}`);
      }
    }
    for (const tabla of ['invitaciones_equipo', 'perfil_asignaciones', 'perfiles']) {
      if (await queryRunner.hasTable(tabla)) await queryRunner.dropTable(tabla);
    }
  }
}
