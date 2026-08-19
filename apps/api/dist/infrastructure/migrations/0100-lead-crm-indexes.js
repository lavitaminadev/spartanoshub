"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadCrmIndexes1755800000000 = void 0;
const typeorm_1 = require("typeorm");
class LeadCrmIndexes1755800000000 {
    constructor() {
        this.name = 'LeadCrmIndexes1755800000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('leads')))
            return;
        const tabla = await queryRunner.getTable('leads');
        if (!tabla?.indices.some((i) => i.name === LeadCrmIndexes1755800000000.ORG_STATUS)) {
            await queryRunner.createIndex('leads', new typeorm_1.TableIndex({
                name: LeadCrmIndexes1755800000000.ORG_STATUS,
                columnNames: ['organization_id', 'status', 'updated_at'],
            }));
        }
        if (!tabla?.indices.some((i) => i.name === LeadCrmIndexes1755800000000.ORG_ASSIGNED)) {
            await queryRunner.createIndex('leads', new typeorm_1.TableIndex({
                name: LeadCrmIndexes1755800000000.ORG_ASSIGNED,
                columnNames: ['organization_id', 'assigned_to'],
            }));
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('leads')))
            return;
        const tabla = await queryRunner.getTable('leads');
        for (const nombre of [LeadCrmIndexes1755800000000.ORG_STATUS, LeadCrmIndexes1755800000000.ORG_ASSIGNED]) {
            if (tabla?.indices.some((i) => i.name === nombre))
                await queryRunner.dropIndex('leads', nombre);
        }
    }
}
exports.LeadCrmIndexes1755800000000 = LeadCrmIndexes1755800000000;
LeadCrmIndexes1755800000000.ORG_STATUS = 'IDX_leads_org_status_updated';
LeadCrmIndexes1755800000000.ORG_ASSIGNED = 'IDX_leads_org_assigned';
