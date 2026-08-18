"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Automations1755500200000 = void 0;
const typeorm_1 = require("typeorm");
class Automations1755500200000 {
    constructor() {
        this.name = 'Automations1755500200000';
    }
    async up(queryRunner) {
        if (!await queryRunner.hasTable('automations')) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'automations',
                columns: [
                    { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                    { name: 'organization_id', type: 'varchar', length: '36' },
                    { name: 'name', type: 'varchar', length: '150' },
                    { name: 'description', type: 'text', isNullable: true },
                    { name: 'trigger_type', type: 'varchar', length: '60' },
                    { name: 'is_active', type: 'boolean', default: false },
                    { name: 'version', type: 'int', default: 1 },
                    { name: 'graph', type: 'json' },
                    { name: 'run_as_user_id', type: 'varchar', length: '36' },
                    { name: 'created_by', type: 'varchar', length: '36', isNullable: true },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                    { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
                ],
            }), true);
            await queryRunner.createIndex('automations', new typeorm_1.TableIndex({
                name: 'IDX_automations_org_trigger_active',
                columnNames: ['organization_id', 'trigger_type', 'is_active'],
            }));
        }
        if (!await queryRunner.hasTable('automation_runs')) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'automation_runs',
                columns: [
                    { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                    { name: 'organization_id', type: 'varchar', length: '36' },
                    { name: 'automation_id', type: 'varchar', length: '36' },
                    { name: 'automation_version', type: 'int', default: 1 },
                    { name: 'trigger_key', type: 'varchar', length: '190' },
                    { name: 'entity_type', type: 'varchar', length: '40' },
                    { name: 'entity_id', type: 'varchar', length: '36' },
                    { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
                    { name: 'context', type: 'json', isNullable: true },
                    { name: 'current_node_id', type: 'varchar', length: '60', isNullable: true },
                    { name: 'resume_at', type: 'timestamp', isNullable: true },
                    { name: 'attempts', type: 'int', default: 0 },
                    { name: 'last_error', type: 'text', isNullable: true },
                    { name: 'started_at', type: 'timestamp', isNullable: true },
                    { name: 'finished_at', type: 'timestamp', isNullable: true },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                    { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
                ],
            }), true);
            await queryRunner.createIndex('automation_runs', new typeorm_1.TableIndex({
                name: 'UQ_automation_runs_trigger',
                columnNames: ['organization_id', 'automation_id', 'trigger_key'],
                isUnique: true,
            }));
            await queryRunner.createIndex('automation_runs', new typeorm_1.TableIndex({
                name: 'IDX_automation_runs_resume',
                columnNames: ['status', 'resume_at'],
            }));
        }
        if (!await queryRunner.hasTable('automation_run_steps')) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'automation_run_steps',
                columns: [
                    { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                    { name: 'run_id', type: 'varchar', length: '36' },
                    { name: 'node_id', type: 'varchar', length: '60' },
                    { name: 'node_type', type: 'varchar', length: '20' },
                    { name: 'node_key', type: 'varchar', length: '60' },
                    { name: 'status', type: 'varchar', length: '20' },
                    { name: 'input', type: 'json', isNullable: true },
                    { name: 'output', type: 'json', isNullable: true },
                    { name: 'error', type: 'text', isNullable: true },
                    { name: 'duration_ms', type: 'int', isNullable: true },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                ],
            }), true);
            await queryRunner.createIndex('automation_run_steps', new typeorm_1.TableIndex({
                name: 'IDX_automation_run_steps_run',
                columnNames: ['run_id', 'created_at'],
            }));
        }
    }
    async down(queryRunner) {
        for (const table of ['automation_run_steps', 'automation_runs', 'automations']) {
            if (await queryRunner.hasTable(table))
                await queryRunner.dropTable(table);
        }
    }
}
exports.Automations1755500200000 = Automations1755500200000;
