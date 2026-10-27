import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';
import { hayColumna } from './helpers/catalogo';

/**
 * Los perfiles de cada empresa, a quién se asignan y las invitaciones al equipo.
 *
 * Sin llaves foráneas hacia `users` en las columnas de autoría: borrar a quien invitó no debe
 * arrastrar el registro de que la invitación existió. Las de empresa y perfil sí cascadean,
 * porque sin ellas la fila no significa nada.
 *
 * Las tablas se crean con el constructor de TypeORM y las columnas de identificador se declaran
 * `uuid`, igual que las otras veintiuna migraciones que crean llaves foráneas. No es estilo: una
 * llave foránea exige que las dos columnas coincidan en tipo, juego de caracteres y colación, y
 * `clients` se creó con este mismo constructor. Declarando `uuid` se genera la misma definición
 * que allí, así que calzan por construcción; escribir el `CREATE TABLE` a mano acierta el tipo y
 * deja el resto al azar, que es como esta migración fallaba con «errno 150».
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
        ['retired_by', 'VARCHAR(36) NULL'],
        ['retired_reason', 'VARCHAR(300) NULL'],
        ['retired_outcome', 'VARCHAR(10) NULL'],
        ['reentered_at', 'TIMESTAMP NULL'],
        ['reentered_by', 'VARCHAR(36) NULL'],
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
      await queryRunner.createTable(
        new Table({
          name: 'perfiles',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true },
            { name: 'organization_id', type: 'uuid' },
            { name: 'client_id', type: 'uuid' },
            { name: 'name', type: 'varchar', length: '80' },
            { name: 'description', type: 'varchar', length: '300', isNullable: true },
            { name: 'areas', type: 'json' },
            { name: 'protected_data', type: 'json' },
            { name: 'created_by', type: 'uuid', isNullable: true },
            { name: 'created_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
            { name: 'updated_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
          ],
        }),
        true,
      );
      // Un nombre de perfil se repite entre empresas y no dentro de una: «Anfitrión» existe en
      // todos los locales y una sola vez en cada uno.
      await queryRunner.createIndex(
        'perfiles',
        new TableIndex({ name: 'UQ_perfil_empresa_nombre', columnNames: ['client_id', 'name'], isUnique: true }),
      );
      await queryRunner.createForeignKey(
        'perfiles',
        new TableForeignKey({
          name: 'FK_perfiles_client',
          columnNames: ['client_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clients',
          onDelete: 'CASCADE',
        }),
      );
    }

    if (!(await queryRunner.hasTable('perfil_asignaciones'))) {
      await queryRunner.createTable(
        new Table({
          name: 'perfil_asignaciones',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true },
            { name: 'organization_id', type: 'uuid' },
            { name: 'client_id', type: 'uuid' },
            { name: 'user_id', type: 'uuid' },
            { name: 'perfil_id', type: 'uuid' },
            { name: 'assigned_by', type: 'uuid', isNullable: true },
            { name: 'created_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
            { name: 'updated_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' },
          ],
        }),
        true,
      );
      // Una persona tiene un perfil por empresa, no varios: si tuviera dos, nada diría cuál manda.
      await queryRunner.createIndex(
        'perfil_asignaciones',
        new TableIndex({ name: 'UQ_perfil_asignacion', columnNames: ['client_id', 'user_id'], isUnique: true }),
      );
      await queryRunner.createIndex(
        'perfil_asignaciones',
        new TableIndex({ name: 'IDX_perfil_asignacion_perfil', columnNames: ['perfil_id'] }),
      );
      await queryRunner.createForeignKeys('perfil_asignaciones', [
        new TableForeignKey({
          name: 'FK_perfil_asignacion_perfil',
          columnNames: ['perfil_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'perfiles',
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          name: 'FK_perfil_asignacion_user',
          columnNames: ['user_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'users',
          onDelete: 'CASCADE',
        }),
      ]);
    }

    if (!(await queryRunner.hasTable('invitaciones_equipo'))) {
      await queryRunner.createTable(
        new Table({
          name: 'invitaciones_equipo',
          columns: [
            { name: 'id', type: 'uuid', isPrimary: true },
            { name: 'organization_id', type: 'uuid' },
            { name: 'client_id', type: 'uuid' },
            { name: 'email', type: 'varchar', length: '255' },
            { name: 'perfil_id', type: 'uuid' },
            { name: 'token_hash', type: 'varchar', length: '64' },
            { name: 'invited_by', type: 'uuid' },
            { name: 'expires_at', type: 'timestamp' },
            { name: 'accepted_at', type: 'timestamp', isNullable: true },
            { name: 'revoked_at', type: 'timestamp', isNullable: true },
            { name: 'lifts_ban', type: 'tinyint', width: 1, default: 0 },
            { name: 'reentry_reason', type: 'varchar', length: '300', isNullable: true },
            { name: 'created_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
          ],
        }),
        true,
      );
      // La invitación se busca por su token, que es único, y se lista por empresa y correo.
      await queryRunner.createIndex(
        'invitaciones_equipo',
        new TableIndex({ name: 'UQ_invitacion_token', columnNames: ['token_hash'], isUnique: true }),
      );
      await queryRunner.createIndex(
        'invitaciones_equipo',
        new TableIndex({ name: 'IDX_invitacion_empresa_correo', columnNames: ['client_id', 'email'] }),
      );
      await queryRunner.createForeignKeys('invitaciones_equipo', [
        new TableForeignKey({
          name: 'FK_invitacion_client',
          columnNames: ['client_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'clients',
          onDelete: 'CASCADE',
        }),
        new TableForeignKey({
          name: 'FK_invitacion_perfil',
          columnNames: ['perfil_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'perfiles',
          onDelete: 'CASCADE',
        }),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_client_access')) {
      for (const nombre of ['previous_retired_at', 'reentry_reason', 'reentered_by', 'reentered_at', 'retired_outcome', 'retired_reason', 'retired_by', 'retired_at']) {
        if (await hayColumna(queryRunner, 'user_client_access', nombre)) await queryRunner.query(`ALTER TABLE user_client_access DROP COLUMN ${nombre}`);
      }
    }
    // En orden inverso al de creación: las que apuntan a `perfiles` salen antes que ella.
    for (const tabla of ['invitaciones_equipo', 'perfil_asignaciones', 'perfiles']) {
      if (await queryRunner.hasTable(tabla)) await queryRunner.dropTable(tabla);
    }
  }
}
