"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CrmCampaigns1755900000104 = void 0;
const typeorm_1 = require("typeorm");
class CrmCampaigns1755900000104 {
    constructor() {
        this.name = 'CrmCampaigns1755900000104';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('crm_campaigns'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'crm_campaigns',
            columns: [
                { name: 'id', type: 'char', length: '36', isPrimary: true },
                { name: 'organization_id', type: 'char', length: '36', isNullable: false },
                { name: 'client_id', type: 'char', length: '36', isNullable: true },
                { name: 'name', type: 'varchar', length: '180', isNullable: false },
                { name: 'source', type: 'varchar', length: '50', default: "'Meta Ads'" },
                { name: 'starts_at', type: 'date', isNullable: true },
                { name: 'ends_at', type: 'date', isNullable: true },
                { name: 'investment', type: 'decimal', precision: 14, scale: 2, default: 0 },
                { name: 'status', type: 'varchar', length: '20', default: "'active'" },
                { name: 'created_at', type: 'datetime', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
                {
                    name: 'updated_at',
                    type: 'datetime',
                    precision: 6,
                    default: 'CURRENT_TIMESTAMP(6)',
                    onUpdate: 'CURRENT_TIMESTAMP(6)',
                },
            ],
        }), true);
        await queryRunner.createIndex('crm_campaigns', new typeorm_1.TableIndex({
            name: 'IDX_crm_campaigns_org_name',
            columnNames: ['organization_id', 'name'],
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('crm_campaigns')) {
            await queryRunner.dropTable('crm_campaigns');
        }
    }
}
exports.CrmCampaigns1755900000104 = CrmCampaigns1755900000104;
