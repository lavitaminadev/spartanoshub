"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationClientScope1755900000103 = void 0;
const typeorm_1 = require("typeorm");
class AutomationClientScope1755900000103 {
    constructor() {
        this.name = 'AutomationClientScope1755900000103';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('automations')))
            return;
        if (await queryRunner.hasColumn('automations', 'client_id'))
            return;
        await queryRunner.addColumn('automations', new typeorm_1.TableColumn({
            name: 'client_id',
            type: 'char',
            length: '36',
            isNullable: true,
        }));
        await queryRunner.createIndex('automations', new typeorm_1.TableIndex({
            name: 'IDX_automations_org_client_trigger',
            columnNames: ['organization_id', 'client_id', 'trigger_type'],
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('automations')))
            return;
        const tabla = await queryRunner.getTable('automations');
        if (tabla?.indices.some((indice) => indice.name === 'IDX_automations_org_client_trigger')) {
            await queryRunner.dropIndex('automations', 'IDX_automations_org_client_trigger');
        }
        if (await queryRunner.hasColumn('automations', 'client_id')) {
            await queryRunner.dropColumn('automations', 'client_id');
        }
    }
}
exports.AutomationClientScope1755900000103 = AutomationClientScope1755900000103;
