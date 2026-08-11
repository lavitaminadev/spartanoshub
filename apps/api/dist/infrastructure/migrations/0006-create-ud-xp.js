"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateUdXp1710000000006 = void 0;
const typeorm_1 = require("typeorm");
class CreateUdXp1710000000006 {
    constructor() {
        this.name = 'CreateUdXp1710000000006';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'ud_budgets',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'client_id', type: 'uuid' },
                { name: 'year', type: 'smallint' },
                { name: 'month', type: 'tinyint' },
                { name: 'contracted', type: 'decimal', precision: 8, scale: 2 },
                { name: 'reserved', type: 'decimal', precision: 8, scale: 2, default: 0 },
                { name: 'consumed', type: 'decimal', precision: 8, scale: 2, default: 0 },
                { name: 'status', type: 'varchar', length: '20', default: "'open'" },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'ud_movements',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'ud_budget_id', type: 'uuid' },
                { name: 'piece_id', type: 'uuid', isNullable: true },
                { name: 'type', type: 'varchar', length: '50' },
                { name: 'amount', type: 'decimal', precision: 8, scale: 2 },
                { name: 'reason', type: 'varchar', length: '255', isNullable: true },
                { name: 'actor_id', type: 'uuid', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'xp_periods',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'uuid' },
                { name: 'user_id', type: 'uuid' },
                { name: 'week_start', type: 'date' },
                { name: 'week_end', type: 'date' },
                { name: 'total_xp', type: 'int', default: 0 },
                { name: 'tier', type: 'varchar', length: '20', isNullable: true },
                { name: 'status', type: 'varchar', length: '20', default: "'open'" },
                { name: 'closed_at', type: 'timestamp', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'xp_events',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'xp_period_id', type: 'uuid' },
                { name: 'user_id', type: 'uuid', isNullable: true },
                { name: 'piece_id', type: 'uuid', isNullable: true },
                { name: 'event_type', type: 'varchar', length: '50' },
                { name: 'points', type: 'int' },
                { name: 'description', type: 'varchar', length: '255', isNullable: true },
                { name: 'metadata', type: 'json', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('ud_budgets', new typeorm_1.TableIndex({ name: 'IDX_ud_budgets_client_id', columnNames: ['client_id'] }));
        await queryRunner.createIndex('ud_budgets', new typeorm_1.TableIndex({ name: 'IDX_ud_budgets_year_month', columnNames: ['year', 'month'] }));
        await queryRunner.createIndex('ud_movements', new typeorm_1.TableIndex({ name: 'IDX_ud_movements_ud_budget_id', columnNames: ['ud_budget_id'] }));
        await queryRunner.createIndex('xp_periods', new typeorm_1.TableIndex({ name: 'IDX_xp_periods_user_id', columnNames: ['user_id'] }));
        await queryRunner.createIndex('xp_periods', new typeorm_1.TableIndex({ name: 'IDX_xp_periods_organization_id', columnNames: ['organization_id'] }));
        await queryRunner.createIndex('xp_events', new typeorm_1.TableIndex({ name: 'IDX_xp_events_xp_period_id', columnNames: ['xp_period_id'] }));
        await queryRunner.createForeignKey('ud_budgets', new typeorm_1.TableForeignKey({ columnNames: ['client_id'], referencedColumnNames: ['id'], referencedTableName: 'clients', onDelete: 'CASCADE' }));
        await queryRunner.createForeignKey('ud_movements', new typeorm_1.TableForeignKey({ columnNames: ['ud_budget_id'], referencedColumnNames: ['id'], referencedTableName: 'ud_budgets', onDelete: 'CASCADE' }));
        await queryRunner.createForeignKey('xp_periods', new typeorm_1.TableForeignKey({ columnNames: ['user_id'], referencedColumnNames: ['id'], referencedTableName: 'users', onDelete: 'CASCADE' }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('xp_events');
        await queryRunner.dropTable('xp_periods');
        await queryRunner.dropTable('ud_movements');
        await queryRunner.dropTable('ud_budgets');
    }
}
exports.CreateUdXp1710000000006 = CreateUdXp1710000000006;
//# sourceMappingURL=0006-create-ud-xp.js.map