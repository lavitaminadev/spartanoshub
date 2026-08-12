"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsentVersions1726400200000 = void 0;
const typeorm_1 = require("typeorm");
class ConsentVersions1726400200000 {
    constructor() {
        this.name = 'ConsentVersions1726400200000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('consent_versions'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'consent_versions',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'version', type: 'int' },
                { name: 'title', type: 'varchar', length: '200' },
                { name: 'text', type: 'text' },
                { name: 'published_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'published_by', type: 'varchar', length: '36', isNullable: true },
                { name: 'active', type: 'boolean', default: false },
            ],
        }), true);
        await queryRunner.createIndex('consent_versions', new typeorm_1.TableIndex({
            name: 'UQ_consent_version_number',
            columnNames: ['organization_id', 'version'],
            isUnique: true,
        }));
        await queryRunner.createIndex('consent_versions', new typeorm_1.TableIndex({
            name: 'IDX_consent_version_active',
            columnNames: ['organization_id', 'active'],
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('consent_versions')))
            return;
        await queryRunner.dropTable('consent_versions');
    }
}
exports.ConsentVersions1726400200000 = ConsentVersions1726400200000;
