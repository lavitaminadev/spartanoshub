"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadIngestSources1755700000000 = void 0;
const typeorm_1 = require("typeorm");
class LeadIngestSources1755700000000 {
    constructor() {
        this.name = 'LeadIngestSources1755700000000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('lead_ingest_sources'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'lead_ingest_sources',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'client_id', type: 'varchar', length: '36', isNullable: true },
                { name: 'name', type: 'varchar', length: '120' },
                { name: 'source', type: 'varchar', length: '60' },
                { name: 'token_hash', type: 'varchar', length: '64' },
                { name: 'token_hint', type: 'varchar', length: '12' },
                { name: 'is_active', type: 'tinyint', width: 1, default: 1 },
                { name: 'received_count', type: 'int', default: 0 },
                { name: 'last_received_at', type: 'datetime', isNullable: true },
                { name: 'last_error', type: 'varchar', length: '300', isNullable: true },
                { name: 'last_error_at', type: 'datetime', isNullable: true },
                { name: 'created_by', type: 'varchar', length: '36', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('lead_ingest_sources', new typeorm_1.TableIndex({
            name: 'UQ_lead_ingest_sources_token',
            columnNames: ['token_hash'],
            isUnique: true,
        }));
        await queryRunner.createIndex('lead_ingest_sources', new typeorm_1.TableIndex({
            name: 'IDX_lead_ingest_sources_org',
            columnNames: ['organization_id', 'is_active'],
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('lead_ingest_sources')) {
            await queryRunner.dropTable('lead_ingest_sources');
        }
    }
}
exports.LeadIngestSources1755700000000 = LeadIngestSources1755700000000;
