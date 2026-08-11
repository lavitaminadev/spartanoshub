"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountCyclesChargeNotes1710000000013 = void 0;
const typeorm_1 = require("typeorm");
class AccountCyclesChargeNotes1710000000013 {
    constructor() {
        this.name = 'AccountCyclesChargeNotes1710000000013';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'account_cycles',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'uuid' }, { name: 'client_id', type: 'uuid' },
                { name: 'year', type: 'smallint' }, { name: 'month', type: 'tinyint' },
                { name: 'status', type: 'varchar', length: '30', default: "'planning'" },
                { name: 'grid_status', type: 'varchar', length: '30', default: "'pending'" },
                { name: 'production_status', type: 'varchar', length: '30', default: "'pending'" },
                { name: 'weekly_meetings_due', type: 'tinyint', default: 4 },
                { name: 'weekly_meetings_completed', type: 'tinyint', default: 0 },
                { name: 'strategy_meeting_status', type: 'varchar', length: '30', default: "'pending'" },
                { name: 'report_status', type: 'varchar', length: '30', default: "'pending'" },
                { name: 'started_at', type: 'date' }, { name: 'ends_at', type: 'date' },
                { name: 'closed_at', type: 'timestamp', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('account_cycles', new typeorm_1.TableIndex({ name: 'UQ_account_cycles_client_period', columnNames: ['client_id', 'year', 'month'], isUnique: true }));
        await queryRunner.createIndex('account_cycles', new typeorm_1.TableIndex({ name: 'IDX_account_cycles_organization', columnNames: ['organization_id'] }));
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'charge_notes',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'uuid' }, { name: 'client_id', type: 'uuid' },
                { name: 'piece_id', type: 'uuid' }, { name: 'correction_id', type: 'uuid' },
                { name: 'status', type: 'varchar', length: '30', default: "'pending_pricing'" },
                { name: 'amount', type: 'decimal', precision: 18, scale: 2, isNullable: true },
                { name: 'currency', type: 'char', length: '3', default: "'CLP'" },
                { name: 'reason', type: 'text' }, { name: 'invoice_id', type: 'uuid', isNullable: true },
                { name: 'created_by', type: 'uuid', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('charge_notes', new typeorm_1.TableIndex({ name: 'UQ_charge_notes_correction', columnNames: ['correction_id'], isUnique: true }));
        await queryRunner.createIndex('charge_notes', new typeorm_1.TableIndex({ name: 'IDX_charge_notes_organization_status', columnNames: ['organization_id', 'status'] }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('charge_notes');
        await queryRunner.dropTable('account_cycles');
    }
}
exports.AccountCyclesChargeNotes1710000000013 = AccountCyclesChargeNotes1710000000013;
//# sourceMappingURL=0013-account-cycles-charge-notes.js.map