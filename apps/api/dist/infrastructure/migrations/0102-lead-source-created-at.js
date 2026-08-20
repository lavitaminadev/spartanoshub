"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadSourceCreatedAt1756000000000 = void 0;
const typeorm_1 = require("typeorm");
class LeadSourceCreatedAt1756000000000 {
    constructor() {
        this.name = 'LeadSourceCreatedAt1756000000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('leads')))
            return;
        if (!(await queryRunner.hasColumn('leads', 'source_created_at'))) {
            await queryRunner.addColumn('leads', new typeorm_1.TableColumn({
                name: 'source_created_at',
                type: 'datetime',
                isNullable: true,
            }));
        }
        const tabla = await queryRunner.getTable('leads');
        if (!tabla?.indices.some((i) => i.name === LeadSourceCreatedAt1756000000000.INDEX)) {
            await queryRunner.createIndex('leads', new typeorm_1.TableIndex({
                name: LeadSourceCreatedAt1756000000000.INDEX,
                columnNames: ['organization_id', 'source_created_at'],
            }));
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('leads')))
            return;
        const tabla = await queryRunner.getTable('leads');
        if (tabla?.indices.some((i) => i.name === LeadSourceCreatedAt1756000000000.INDEX)) {
            await queryRunner.dropIndex('leads', LeadSourceCreatedAt1756000000000.INDEX);
        }
        if (await queryRunner.hasColumn('leads', 'source_created_at')) {
            await queryRunner.dropColumn('leads', 'source_created_at');
        }
    }
}
exports.LeadSourceCreatedAt1756000000000 = LeadSourceCreatedAt1756000000000;
LeadSourceCreatedAt1756000000000.INDEX = 'IDX_leads_org_source_created';
