import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/** Vincula cada llave con su campaña sin depender de un nombre modificable. */
export class IngestSourceCampaignLink1755900000109 implements MigrationInterface {
  name = 'IngestSourceCampaignLink1755900000109';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('lead_ingest_sources'))) return;
    if (!(await queryRunner.hasColumn('lead_ingest_sources', 'campaign_id'))) {
      await queryRunner.addColumn('lead_ingest_sources', new TableColumn({
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
      await queryRunner.createIndex('lead_ingest_sources', new TableIndex({
        name: 'IDX_lead_ingest_sources_campaign', columnNames: ['organization_id', 'campaign_id'],
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('lead_ingest_sources');
    const index = table?.indices.find((item) => item.name === 'IDX_lead_ingest_sources_campaign');
    if (index) await queryRunner.dropIndex('lead_ingest_sources', index);
    if (await queryRunner.hasColumn('lead_ingest_sources', 'campaign_id')) {
      await queryRunner.dropColumn('lead_ingest_sources', 'campaign_id');
    }
  }
}
