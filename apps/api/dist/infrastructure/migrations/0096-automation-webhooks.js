"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutomationWebhooks1755500300000 = void 0;
const typeorm_1 = require("typeorm");
class AutomationWebhooks1755500300000 {
    constructor() {
        this.name = 'AutomationWebhooks1755500300000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('automation_webhook_deliveries'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'automation_webhook_deliveries',
            columns: [
                { name: 'id', type: 'varchar', length: '36', isPrimary: true },
                { name: 'organization_id', type: 'varchar', length: '36' },
                { name: 'run_id', type: 'varchar', length: '36', isNullable: true },
                { name: 'url', type: 'varchar', length: '500' },
                { name: 'payload', type: 'json' },
                { name: 'status', type: 'varchar', length: '20', default: "'pending'" },
                { name: 'attempts', type: 'int', default: 0 },
                { name: 'next_attempt_at', type: 'timestamp', isNullable: true },
                { name: 'last_status_code', type: 'int', isNullable: true },
                { name: 'last_error', type: 'text', isNullable: true },
                { name: 'sent_at', type: 'timestamp', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('automation_webhook_deliveries', new typeorm_1.TableIndex({
            name: 'IDX_webhook_deliveries_pending',
            columnNames: ['status', 'next_attempt_at'],
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('automation_webhook_deliveries')) {
            await queryRunner.dropTable('automation_webhook_deliveries');
        }
    }
}
exports.AutomationWebhooks1755500300000 = AutomationWebhooks1755500300000;
