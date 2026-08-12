"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaConversionOutbox1710000000014 = void 0;
const typeorm_1 = require("typeorm");
class MetaConversionOutbox1710000000014 {
    constructor() {
        this.name = 'MetaConversionOutbox1710000000014';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'meta_conversion_outbox',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'uuid' },
                { name: 'event_id', type: 'varchar', length: '255' },
                { name: 'pixel_id', type: 'varchar', length: '255' },
                { name: 'event_data', type: 'json' },
                { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
                { name: 'attempts', type: 'int', default: 0 },
                { name: 'next_attempt_at', type: 'timestamp', isNullable: true },
                { name: 'last_error', type: 'text', isNullable: true },
                { name: 'processed_at', type: 'timestamp', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('meta_conversion_outbox', new typeorm_1.TableIndex({ name: 'UQ_meta_conversion_event', columnNames: ['organization_id', 'event_id'], isUnique: true }));
        await queryRunner.createIndex('meta_conversion_outbox', new typeorm_1.TableIndex({ name: 'IDX_meta_conversion_outbox_pending', columnNames: ['status', 'next_attempt_at'] }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('meta_conversion_outbox');
    }
}
exports.MetaConversionOutbox1710000000014 = MetaConversionOutbox1710000000014;
//# sourceMappingURL=0014-meta-conversion-outbox.js.map