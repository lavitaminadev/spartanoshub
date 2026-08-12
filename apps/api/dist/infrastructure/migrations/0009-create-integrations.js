"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateIntegrations1710000000009 = void 0;
const typeorm_1 = require("typeorm");
class CreateIntegrations1710000000009 {
    constructor() {
        this.name = 'CreateIntegrations1710000000009';
    }
    async up(queryRunner) {
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'integrations',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'organization_id', type: 'uuid' },
                { name: 'provider', type: 'varchar', length: '50' },
                { name: 'name', type: 'varchar', length: '255' },
                { name: 'status', type: 'varchar', length: '50', default: "'pending'" },
                { name: 'config', type: 'json', isNullable: true },
                { name: 'error_message', type: 'text', isNullable: true },
                { name: 'last_sync_at', type: 'timestamp', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'integration_accounts',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'integration_id', type: 'uuid' },
                { name: 'account_type', type: 'varchar', length: '50' },
                { name: 'external_id', type: 'varchar', length: '255' },
                { name: 'external_name', type: 'varchar', length: '255' },
                { name: 'access_token', type: 'text', isNullable: true },
                { name: 'refresh_token', type: 'text', isNullable: true },
                { name: 'token_expires_at', type: 'timestamp', isNullable: true },
                { name: 'metadata', type: 'json', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                { name: 'updated_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'sync_runs',
            columns: [
                { name: 'id', type: 'uuid', isPrimary: true, generationStrategy: 'uuid' },
                { name: 'integration_account_id', type: 'uuid' },
                { name: 'status', type: 'varchar', length: '50', default: "'pending'" },
                { name: 'started_at', type: 'timestamp' },
                { name: 'completed_at', type: 'timestamp', isNullable: true },
                { name: 'error', type: 'text', isNullable: true },
                { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
            ],
        }), true);
        await queryRunner.createIndex('integrations', new typeorm_1.TableIndex({ name: 'IDX_integrations_organization_id', columnNames: ['organization_id'] }));
        await queryRunner.createIndex('integrations', new typeorm_1.TableIndex({ name: 'IDX_integrations_provider', columnNames: ['provider'] }));
        await queryRunner.createIndex('integration_accounts', new typeorm_1.TableIndex({ name: 'IDX_integration_accounts_integration_id', columnNames: ['integration_id'] }));
        await queryRunner.createIndex('sync_runs', new typeorm_1.TableIndex({ name: 'IDX_sync_runs_integration_account_id', columnNames: ['integration_account_id'] }));
        await queryRunner.createForeignKey('integrations', new typeorm_1.TableForeignKey({ columnNames: ['organization_id'], referencedColumnNames: ['id'], referencedTableName: 'organizations', onDelete: 'CASCADE' }));
        await queryRunner.createForeignKey('integration_accounts', new typeorm_1.TableForeignKey({ columnNames: ['integration_id'], referencedColumnNames: ['id'], referencedTableName: 'integrations', onDelete: 'CASCADE' }));
        await queryRunner.createForeignKey('sync_runs', new typeorm_1.TableForeignKey({ columnNames: ['integration_account_id'], referencedColumnNames: ['id'], referencedTableName: 'integration_accounts', onDelete: 'CASCADE' }));
    }
    async down(queryRunner) {
        await queryRunner.dropTable('sync_runs');
        await queryRunner.dropTable('integration_accounts');
        await queryRunner.dropTable('integrations');
    }
}
exports.CreateIntegrations1710000000009 = CreateIntegrations1710000000009;
//# sourceMappingURL=0009-create-integrations.js.map