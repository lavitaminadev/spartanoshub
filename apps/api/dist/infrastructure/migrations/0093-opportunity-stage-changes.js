"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpportunityStageChanges1755500000000 = void 0;
const typeorm_1 = require("typeorm");
class OpportunityStageChanges1755500000000 {
    constructor() {
        this.name = 'OpportunityStageChanges1755500000000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('crm_opportunity_stage_changes'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'crm_opportunity_stage_changes',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'opportunity_id', type: 'varchar', length: '36' },
                { name: 'from_stage', type: 'varchar', length: '50', isNullable: true },
                { name: 'to_stage', type: 'varchar', length: '50' },
                { name: 'duration_hours', type: 'decimal', precision: 12, scale: 2, isNullable: true },
                { name: 'changed_by', type: 'varchar', length: '36', isNullable: true },
                { name: 'loss_reason', type: 'varchar', length: '60', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('crm_opportunity_stage_changes', new typeorm_1.TableIndex({
            name: 'IDX_opportunity_stage_changes_opportunity',
            columnNames: ['opportunity_id', 'created_at'],
        }));
        await queryRunner.createIndex('crm_opportunity_stage_changes', new typeorm_1.TableIndex({
            name: 'IDX_opportunity_stage_changes_org_stage',
            columnNames: ['organization_id', 'to_stage', 'created_at'],
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('crm_opportunity_stage_changes')) {
            await queryRunner.dropTable('crm_opportunity_stage_changes');
        }
    }
}
exports.OpportunityStageChanges1755500000000 = OpportunityStageChanges1755500000000;
