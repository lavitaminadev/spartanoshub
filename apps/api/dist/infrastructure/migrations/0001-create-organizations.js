"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateOrganizations1710000000001 = void 0;
const typeorm_1 = require("typeorm");
class CreateOrganizations1710000000001 {
    constructor() {
        this.name = 'CreateOrganizations1710000000001';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'organizations',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'name', type: 'varchar', length: '255' },
                { name: 'code', type: 'varchar', length: '50', isUnique: true },
                { name: 'logo_url', type: 'varchar', length: '255', isNullable: true },
                { name: 'currency', type: 'char', length: '3', default: "'CLP'" },
                { name: 'is_active', type: 'boolean', default: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('organizations', new typeorm_1.TableIndex({ name: 'IDX_organizations_code', columnNames: ['code'] }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('organizations');
    }
}
exports.CreateOrganizations1710000000001 = CreateOrganizations1710000000001;
