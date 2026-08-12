"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.XpDisputes1710000000024 = void 0;
const typeorm_1 = require("typeorm");
class XpDisputes1710000000024 {
    constructor() {
        this.name = 'XpDisputes1710000000024';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('xp_disputes'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'xp_disputes',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'uuid' },
                { name: 'xp_period_id', type: 'uuid' },
                { name: 'user_id', type: 'uuid' },
                { name: 'message', type: 'text' },
                { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
                { name: 'resolution', type: 'text', isNullable: true },
                { name: 'adjustment_points', type: 'int', default: 0 },
                { name: 'resolved_by', type: 'uuid', isNullable: true },
                { name: 'resolved_at', type: 'timestamp', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            ],
            foreignKeys: [
                { columnNames: ['organization_id'], referencedTableName: 'organizations', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
                { columnNames: ['xp_period_id'], referencedTableName: 'xp_periods', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
                { columnNames: ['user_id'], referencedTableName: 'users', referencedColumnNames: ['id'], onDelete: 'CASCADE' },
            ],
        }));
        await queryRunner.createIndex('xp_disputes', new typeorm_1.TableIndex({ name: 'IDX_xp_disputes_org_status', columnNames: ['organization_id', 'status'] }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('xp_disputes'))
            await queryRunner.dropTable('xp_disputes');
    }
}
exports.XpDisputes1710000000024 = XpDisputes1710000000024;
