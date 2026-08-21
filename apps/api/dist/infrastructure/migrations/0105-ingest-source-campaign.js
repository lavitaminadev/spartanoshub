"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IngestSourceCampaign1755900000105 = void 0;
const typeorm_1 = require("typeorm");
class IngestSourceCampaign1755900000105 {
    constructor() {
        this.name = 'IngestSourceCampaign1755900000105';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('lead_ingest_sources')))
            return;
        if (await queryRunner.hasColumn('lead_ingest_sources', 'campaign_name'))
            return;
        await queryRunner.addColumn('lead_ingest_sources', new typeorm_1.TableColumn({
            name: 'campaign_name',
            type: 'varchar',
            length: '180',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('lead_ingest_sources', 'campaign_name')) {
            await queryRunner.dropColumn('lead_ingest_sources', 'campaign_name');
        }
    }
}
exports.IngestSourceCampaign1755900000105 = IngestSourceCampaign1755900000105;
