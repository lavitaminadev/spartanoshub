"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminAccessSecurity1710000000020 = void 0;
const typeorm_1 = require("typeorm");
class AdminAccessSecurity1710000000020 {
    constructor() {
        this.name = 'AdminAccessSecurity1710000000020';
    }
    async up(queryRunner) {
        await this.ensureColumn(queryRunner, 'users', new typeorm_1.TableColumn({ name: 'work_mode', type: 'varchar', length: '20', isNullable: true }));
        await this.ensureColumn(queryRunner, 'users', new typeorm_1.TableColumn({ name: 'must_change_password', type: 'boolean', default: false }));
        await this.ensureColumn(queryRunner, 'users', new typeorm_1.TableColumn({ name: 'invited_at', type: 'timestamp', isNullable: true }));
        await this.ensureColumn(queryRunner, 'users', new typeorm_1.TableColumn({ name: 'password_changed_at', type: 'timestamp', isNullable: true }));
        if (!await queryRunner.hasTable('password_reset_tokens')) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'password_reset_tokens',
                columns: [
                    { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid', isGenerated: true },
                    { name: 'organization_id', type: 'uuid' },
                    { name: 'user_id', type: 'uuid' },
                    { name: 'token_hash', type: 'varchar', length: '64', isUnique: true },
                    { name: 'expires_at', type: 'timestamp' },
                    { name: 'used_at', type: 'timestamp', isNullable: true },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                ],
                foreignKeys: [
                    new typeorm_1.TableForeignKey({ columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
                    new typeorm_1.TableForeignKey({ columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' }),
                ],
                indices: [
                    new typeorm_1.TableIndex({ name: 'IDX_password_reset_user', columnNames: ['user_id', 'used_at'] }),
                    new typeorm_1.TableIndex({ name: 'IDX_password_reset_expiry', columnNames: ['expires_at'] }),
                ],
            }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('password_reset_tokens'))
            await queryRunner.dropTable('password_reset_tokens');
        for (const column of ['password_changed_at', 'invited_at', 'must_change_password', 'work_mode']) {
            if (await queryRunner.hasColumn('users', column))
                await queryRunner.dropColumn('users', column);
        }
    }
    async ensureColumn(queryRunner, table, column) {
        if (!await queryRunner.hasColumn(table, column.name))
            await queryRunner.addColumn(table, column);
    }
}
exports.AdminAccessSecurity1710000000020 = AdminAccessSecurity1710000000020;
