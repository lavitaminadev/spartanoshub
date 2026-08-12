"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPermissionOverrides1724247700000 = void 0;
const typeorm_1 = require("typeorm");
class UserPermissionOverrides1724247700000 {
    constructor() {
        this.name = 'UserPermissionOverrides1724247700000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('user_permission_overrides'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'user_permission_overrides',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'user_id', type: 'varchar', length: '36' },
                { name: 'module', type: 'varchar', length: '60' },
                { name: 'level', type: 'varchar', length: '20' },
                { name: 'reason', type: 'varchar', length: '300', isNullable: true },
                { name: 'granted_by', type: 'varchar', length: '36', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('user_permission_overrides', new typeorm_1.TableIndex({
            name: 'UQ_user_permission_override',
            columnNames: ['user_id', 'module'],
            isUnique: true,
        }));
        await queryRunner.createIndex('user_permission_overrides', new typeorm_1.TableIndex({
            name: 'IDX_user_permission_override_org',
            columnNames: ['organization_id', 'user_id'],
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('user_permission_overrides')))
            return;
        await queryRunner.dropTable('user_permission_overrides');
    }
}
exports.UserPermissionOverrides1724247700000 = UserPermissionOverrides1724247700000;
