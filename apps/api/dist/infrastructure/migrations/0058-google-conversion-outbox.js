"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoogleConversionOutbox1724247500000 = void 0;
const typeorm_1 = require("typeorm");
class GoogleConversionOutbox1724247500000 {
    constructor() {
        this.name = 'GoogleConversionOutbox1724247500000';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'google_conversion_outbox',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'event_id', type: 'varchar', length: '255' },
                { name: 'customer_id', type: 'varchar', length: '32' },
                { name: 'conversion_action', type: 'varchar', length: '255' },
                { name: 'conversion_data', type: 'json' },
                { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
                { name: 'attempts', type: 'int', default: 0 },
                { name: 'next_attempt_at', type: 'timestamp', isNullable: true },
                { name: 'last_error', type: 'text', isNullable: true },
                { name: 'processed_at', type: 'timestamp', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('google_conversion_outbox', new typeorm_1.TableIndex({ name: 'UQ_google_conversion_event', columnNames: ['organization_id', 'event_id'], isUnique: true }));
        await queryRunner.createIndex('google_conversion_outbox', new typeorm_1.TableIndex({ name: 'IDX_google_conversion_outbox_pending', columnNames: ['status', 'next_attempt_at'] }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('google_conversion_outbox');
    }
}
exports.GoogleConversionOutbox1724247500000 = GoogleConversionOutbox1724247500000;
