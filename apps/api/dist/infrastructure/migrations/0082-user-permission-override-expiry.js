"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPermissionOverrideExpiry1726400100000 = void 0;
const typeorm_1 = require("typeorm");
class UserPermissionOverrideExpiry1726400100000 {
    constructor() {
        this.name = 'UserPermissionOverrideExpiry1726400100000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('user_permission_overrides')))
            return;
        const table = await queryRunner.getTable('user_permission_overrides');
        if (table?.findColumnByName('expires_at'))
            return;
        await queryRunner.addColumn('user_permission_overrides', new typeorm_1.TableColumn({
            name: 'expires_at',
            type: 'timestamp',
            isNullable: true,
        }));
        await queryRunner.createIndex('user_permission_overrides', new typeorm_1.TableIndex({
            name: 'IDX_user_permission_override_expires',
            columnNames: ['organization_id', 'expires_at'],
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('user_permission_overrides')))
            return;
        const table = await queryRunner.getTable('user_permission_overrides');
        if (table?.indices.some((index) => index.name === 'IDX_user_permission_override_expires')) {
            await queryRunner.dropIndex('user_permission_overrides', 'IDX_user_permission_override_expires');
        }
        if (table?.findColumnByName('expires_at')) {
            await queryRunner.dropColumn('user_permission_overrides', 'expires_at');
        }
    }
}
exports.UserPermissionOverrideExpiry1726400100000 = UserPermissionOverrideExpiry1726400100000;
