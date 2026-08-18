"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmInteractionsIndex1755500100000 = void 0;
const typeorm_1 = require("typeorm");
class CrmInteractionsIndex1755500100000 {
    constructor() {
        this.name = 'CrmInteractionsIndex1755500100000';
        this.indexName = 'IDX_crm_interactions_org_lead_date';
    }
    async up(queryRunner) {
        const table = await queryRunner.getTable('crm_interactions');
        if (!table || table.indices.some((index) => index.name === this.indexName))
            return;
        await queryRunner.createIndex('crm_interactions', new typeorm_1.TableIndex({
            name: this.indexName,
            columnNames: ['organization_id', 'lead_id', 'date'],
        }));
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('crm_interactions');
        if (table?.indices.some((index) => index.name === this.indexName)) {
            await queryRunner.dropIndex('crm_interactions', this.indexName);
        }
    }
}
exports.CrmInteractionsIndex1755500100000 = CrmInteractionsIndex1755500100000;
