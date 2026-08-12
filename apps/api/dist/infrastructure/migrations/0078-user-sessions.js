"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSessions1726300000000 = void 0;
const typeorm_1 = require("typeorm");
class UserSessions1726300000000 {
    constructor() {
        this.name = 'UserSessions1726300000000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('user_sessions'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
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
        await queryRunner.createIndex('user_sessions', new typeorm_1.TableIndex({
            name: 'IDX_user_sessions_user_active', columnNames: ['user_id', 'revoked_at'],
        }));
        await queryRunner.createIndex('user_sessions', new typeorm_1.TableIndex({
            name: 'IDX_user_sessions_refresh_hash', columnNames: ['refresh_token_hash'],
        }));
        await queryRunner.createIndex('user_sessions', new typeorm_1.TableIndex({
            name: 'IDX_user_sessions_expires', columnNames: ['expires_at'],
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('user_sessions'))
            await queryRunner.dropTable('user_sessions');
    }
}
exports.UserSessions1726300000000 = UserSessions1726300000000;
