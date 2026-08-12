"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationMetrics1710000000015 = void 0;
const typeorm_1 = require("typeorm");
class IntegrationMetrics1710000000015 {
    constructor() {
        this.name = 'IntegrationMetrics1710000000015';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({ name: 'integration_metrics', columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'uuid' }, { name: 'client_id', type: 'uuid' },
                { name: 'provider', type: 'varchar', length: '30' }, { name: 'external_account_id', type: 'varchar', length: '255' },
                { name: 'metric_date', type: 'date' }, { name: 'spend', type: 'decimal', precision: 18, scale: 2, default: 0 },
                { name: 'impressions', type: 'bigint', default: 0 }, { name: 'reach', type: 'bigint', default: 0 },
                { name: 'clicks', type: 'bigint', default: 0 }, { name: 'conversions', type: 'decimal', precision: 18, scale: 4, default: 0 },
                { name: 'leads', type: 'decimal', precision: 18, scale: 4, default: 0 }, { name: 'breakdown', type: 'json', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' }, { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ] }), true);
        await queryRunner.createIndex('integration_metrics', new typeorm_1.TableIndex({ name: 'UQ_integration_metric_daily', columnNames: ['provider', 'external_account_id', 'client_id', 'metric_date'], isUnique: true }));
        await queryRunner.createIndex('integration_metrics', new typeorm_1.TableIndex({ name: 'IDX_integration_metrics_org_client_date', columnNames: ['organization_id', 'client_id', 'metric_date'] }));
    }
    async down(queryRunner) { await queryRunner.dropTable('integration_metrics'); }
}
exports.IntegrationMetrics1710000000015 = IntegrationMetrics1710000000015;
//# sourceMappingURL=0015-integration-metrics.js.map