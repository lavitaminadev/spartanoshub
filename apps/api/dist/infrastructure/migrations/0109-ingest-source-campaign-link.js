"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestSourceCampaignLink1755900000109 = void 0;
const typeorm_1 = require("typeorm");
class IngestSourceCampaignLink1755900000109 {
    constructor() {
        this.name = 'IngestSourceCampaignLink1755900000109';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('lead_ingest_sources')))
            return;
        if (!(await queryRunner.hasColumn('lead_ingest_sources', 'campaign_id'))) {
            await queryRunner.addColumn('lead_ingest_sources', new typeorm_1.TableColumn({
                name: 'campaign_id', type: 'char', length: '36', isNullable: true,
            }));
        }
        await queryRunner.query(`
      UPDATE lead_ingest_sources source
      INNER JOIN crm_campaigns campaign
        ON campaign.organization_id = source.organization_id
       AND campaign.name = source.campaign_name
       AND (campaign.client_id = source.client_id OR (campaign.client_id IS NULL AND source.client_id IS NULL))
      SET source.campaign_id = campaign.id
      WHERE source.campaign_id IS NULL
    `);
        const table = await queryRunner.getTable('lead_ingest_sources');
        if (!table?.indices.some((index) => index.name === 'IDX_lead_ingest_sources_campaign')) {
            await queryRunner.createIndex('lead_ingest_sources', new typeorm_1.TableIndex({
                name: 'IDX_lead_ingest_sources_campaign', columnNames: ['organization_id', 'campaign_id'],
            }));
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('lead_ingest_sources');
        const index = table?.indices.find((item) => item.name === 'IDX_lead_ingest_sources_campaign');
        if (index)
            await queryRunner.dropIndex('lead_ingest_sources', index);
        if (await queryRunner.hasColumn('lead_ingest_sources', 'campaign_id')) {
            await queryRunner.dropColumn('lead_ingest_sources', 'campaign_id');
        }
    }
}
exports.IngestSourceCampaignLink1755900000109 = IngestSourceCampaignLink1755900000109;
