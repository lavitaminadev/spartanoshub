import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Sesiones por dispositivo, visibles y revocables.
 *
 * El refresh token vivía en una sola columna de `users`, lo que producía dos cosas que nadie
 * pidió: entrar desde el teléfono cerraba la sesión del computador, y no había forma de listar
 * dónde estaba abierta una cuenta ni de cerrar una sola.
 *
 * `users.refresh_token` no se elimina en esta migración. Las sesiones abiertas al desplegar
 * viven ahí y borrarla las cortaría a todas de golpe; se retira cuando la columna esté vacía.
 */
export class UserSessions1726300000000 implements MigrationInterface {
  name = 'UserSessions1726300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_sessions')) return;

    await queryRunner.createTable(new Table({
      name: 'user_sessions',
      columns: [
        { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
        { name: 'user_id', type: 'uuid' },
        { name: 'organization_id', type: 'uuid' },
        { name: 'refresh_token_hash', type: 'varchar', length: '64' },
        { name: 'reauthenticated_at', type: 'timestamp', isNullable: true },
        { name: 'user_agent', type: 'varchar', length: '400', isNullable: true },
        { name: 'ip_address', type: 'varchar', length: '45', isNullable: true },
        { name: 'last_seen_at', type: 'timestamp', isNullable: true },
        { name: 'expires_at', type: 'timestamp' },
        { name: 'revoked_at', type: 'timestamp', isNullable: true },
        { name: 'revoked_reason', type: 'varchar', length: '60', isNullable: true },
        { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
      ],
      foreignKeys: [{
        columnNames: ['user_id'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }],
    }), true);

    // El acceso caliente: en cada petición se comprueba que la sesión del token siga viva.
    await queryRunner.createIndex('user_sessions', new TableIndex({
      name: 'IDX_user_sessions_user_active', columnNames: ['user_id', 'revoked_at'],
    }));
    // La renovación busca por la huella del token, no por el usuario.
    await queryRunner.createIndex('user_sessions', new TableIndex({
      name: 'IDX_user_sessions_refresh_hash', columnNames: ['refresh_token_hash'],
    }));
    // La limpieza periódica de sesiones vencidas.
    await queryRunner.createIndex('user_sessions', new TableIndex({
      name: 'IDX_user_sessions_expires', columnNames: ['expires_at'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_sessions')) await queryRunner.dropTable('user_sessions');
  }
}
