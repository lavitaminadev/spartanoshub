"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RolePermissionOverrides1726400000000 = void 0;
const typeorm_1 = require("typeorm");
class RolePermissionOverrides1726400000000 {
    constructor() {
        this.name = 'RolePermissionOverrides1726400000000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('role_permission_overrides'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'role_permission_overrides',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'role', type: 'varchar', length: '40' },
                { name: 'module', type: 'varchar', length: '60' },
                { name: 'level', type: 'varchar', length: '20' },
                { name: 'reason', type: 'varchar', length: '300', isNullable: true },
                { name: 'granted_by', type: 'varchar', length: '36', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('role_permission_overrides', new typeorm_1.TableIndex({
            name: 'UQ_role_permission_override',
            columnNames: ['organization_id', 'role', 'module'],
            isUnique: true,
        }));
        await queryRunner.createIndex('role_permission_overrides', new typeorm_1.TableIndex({
            name: 'IDX_role_permission_override_org',
            columnNames: ['organization_id'],
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('role_permission_overrides')))
            return;
        await queryRunner.dropTable('role_permission_overrides');
    }
}
exports.RolePermissionOverrides1726400000000 = RolePermissionOverrides1726400000000;
