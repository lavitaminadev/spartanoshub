"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessStageChanges1755600000000 = void 0;
const typeorm_1 = require("typeorm");
class ProcessStageChanges1755600000000 {
    constructor() {
        this.name = 'ProcessStageChanges1755600000000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('process_stage_changes'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'process_stage_changes',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'subject_type', type: 'varchar', length: '30' },
                { name: 'subject_id', type: 'varchar', length: '36' },
                { name: 'from_stage', type: 'varchar', length: '50', isNullable: true },
                { name: 'to_stage', type: 'varchar', length: '50' },
                { name: 'duration_hours', type: 'decimal', precision: 12, scale: 2, isNullable: true },
                { name: 'changed_by', type: 'varchar', length: '36', isNullable: true },
                { name: 'reason', type: 'varchar', length: '300', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('process_stage_changes', new typeorm_1.TableIndex({
            name: 'IDX_process_stage_changes_subject',
            columnNames: ['subject_type', 'subject_id', 'created_at'],
        }));
        await queryRunner.createIndex('process_stage_changes', new typeorm_1.TableIndex({
            name: 'IDX_process_stage_changes_org_stage',
            columnNames: ['organization_id', 'subject_type', 'to_stage', 'created_at'],
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('process_stage_changes')) {
            await queryRunner.dropTable('process_stage_changes');
        }
    }
}
exports.ProcessStageChanges1755600000000 = ProcessStageChanges1755600000000;
