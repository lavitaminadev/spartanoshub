"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUsers1710000000002 = void 0;
const typeorm_1 = require("typeorm");
class CreateUsers1710000000002 {
    constructor() {
        this.name = 'CreateUsers1710000000002';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'users',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'uuid' },
                { name: 'name', type: 'varchar', length: '255' },
                { name: 'email', type: 'varchar', length: '255', isUnique: true },
                { name: 'password', type: 'varchar', length: '255' },
                { name: 'phone', type: 'varchar', length: '20', isNullable: true },
                { name: 'role', type: 'varchar', length: '50', default: "'designer'" },
                { name: 'avatar_url', type: 'varchar', length: '255', isNullable: true },
                { name: 'is_active', type: 'boolean', default: true },
                { name: 'refresh_token', type: 'text', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('users', new typeorm_1.TableIndex({ name: 'IDX_users_organization_id', columnNames: ['organization_id'] }));
        await queryRunner.createIndex('users', new typeorm_1.TableIndex({ name: 'IDX_users_email', columnNames: ['email'] }));
        await queryRunner.createIndex('users', new typeorm_1.TableIndex({ name: 'IDX_users_role', columnNames: ['role'] }));
        await queryRunner.createForeignKey('users', new typeorm_1.TableForeignKey({
            columnNames: ['organization_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'organizations',
            onDelete: 'CASCADE',
        }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('users');
    }
}
exports.CreateUsers1710000000002 = CreateUsers1710000000002;
//# sourceMappingURL=0002-create-users.js.map