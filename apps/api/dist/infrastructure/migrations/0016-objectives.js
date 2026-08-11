"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Objectives1710000000016 = void 0;
const typeorm_1 = require("typeorm");
class Objectives1710000000016 {
    constructor() {
        this.name = 'Objectives1710000000016';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({ name: 'objectives', columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' }, { name: 'organization_id', type: 'uuid' },
                { name: 'owner_id', type: 'uuid', isNullable: true }, { name: 'client_id', type: 'uuid', isNullable: true }, { name: 'category', type: 'varchar', length: '30' },
                { name: 'title', type: 'varchar', length: '255' }, { name: 'description', type: 'text', isNullable: true }, { name: 'status', type: 'varchar', length: '20', default: "'active'" },
                { name: 'progress', type: 'tinyint', default: 0 }, { name: 'due_at', type: 'date', isNullable: true }, { name: 'created_by', type: 'uuid' },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }, { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ] }), true);
        await queryRunner.createIndex('objectives', new typeorm_1.TableIndex({ name: 'IDX_objectives_org_status', columnNames: ['organization_id', 'status'] }));
    }
    async down(queryRunner) { await queryRunner.dropTable('objectives'); }
}
exports.Objectives1710000000016 = Objectives1710000000016;
//# sourceMappingURL=0016-objectives.js.map