"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadClientId1710000000028 = void 0;
const typeorm_1 = require("typeorm");
class LeadClientId1710000000028 {
    constructor() {
        this.name = 'LeadClientId1710000000028';
    }
    async up(queryRunner) {
        if (!await queryRunner.hasColumn('leads', 'client_id')) {
            await queryRunner.addColumn('leads', new typeorm_1.TableColumn({ name: 'client_id', type: 'uuid', isNullable: true }));
        }
        const table = await queryRunner.getTable('leads');
        if (table && !table.indices.some((index) => index.name === 'IDX_leads_client_id')) {
            await queryRunner.createIndex('leads', new typeorm_1.TableIndex({ name: 'IDX_leads_client_id', columnNames: ['client_id'] }));
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('leads');
        if (table) {
            const index = table.indices.find((item) => item.name === 'IDX_leads_client_id');
            if (index)
                await queryRunner.dropIndex('leads', index);
        }
        if (await queryRunner.hasColumn('leads', 'client_id')) {
            await queryRunner.dropColumn('leads', 'client_id');
        }
    }
}
exports.LeadClientId1710000000028 = LeadClientId1710000000028;
//# sourceMappingURL=0028-lead-client-id.js.map