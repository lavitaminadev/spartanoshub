"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddProductionIndexes1721756400000 = void 0;
const indexes_1 = require("./helpers/indexes");
const INDEXES = [
    { table: 'leads', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
    { table: 'leads', name: 'idx_org_status', columns: ['organization_id', 'status'] },
    { table: 'leads', name: 'idx_org_created', columns: ['organization_id', 'created_at'], definition: '(organization_id, created_at DESC)' },
    { table: 'crm_opportunities', name: 'idx_org_lead', columns: ['organization_id', 'lead_id'] },
    { table: 'crm_opportunities', name: 'idx_org_stage', columns: ['organization_id', 'stage'] },
    { table: 'crm_contacts', name: 'idx_org_lead', columns: ['organization_id', 'lead_id'] },
    { table: 'crm_interactions', name: 'idx_org_lead', columns: ['organization_id', 'lead_id'] },
    { table: 'clients', name: 'idx_org_created', columns: ['organization_id', 'created_at'], definition: '(organization_id, created_at DESC)' },
    { table: 'clients', name: 'idx_org_status', columns: ['organization_id', 'status'] },
    { table: 'pieces', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
    { table: 'pieces', name: 'idx_org_status', columns: ['organization_id', 'status'] },
    { table: 'pieces', name: 'idx_org_created', columns: ['organization_id', 'created_at'], definition: '(organization_id, created_at DESC)' },
    { table: 'content_grids', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
    { table: 'meetings', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
    { table: 'meetings', name: 'idx_org_scheduled', columns: ['organization_id', 'scheduled_at'] },
    { table: 'contracts', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
    { table: 'contracts', name: 'idx_org_status', columns: ['organization_id', 'status'] },
    { table: 'briefs', name: 'idx_org_client', columns: ['organization_id', 'client_id'] },
    { table: 'briefs', name: 'idx_org_status', columns: ['organization_id', 'status'] },
    { table: 'integration_accounts', name: 'idx_org_type', columns: ['organization_id', 'account_type'] },
    { table: 'integration_metrics', name: 'idx_org_account_date', columns: ['organization_id', 'external_account_id', 'metric_date'] },
    { table: 'meta_lead_webhook_events', name: 'idx_page_leadgen', columns: ['page_id', 'leadgen_id'] },
    { table: 'meta_conversion_outbox', name: 'idx_org_status', columns: ['organization_id', 'status', 'created_at'] },
];
class AddProductionIndexes1721756400000 {
    async up(queryRunner) {
        await (0, indexes_1.ensureIndexes)(queryRunner, INDEXES);
    }
    async down(queryRunner) {
        await (0, indexes_1.dropIndexes)(queryRunner, INDEXES);
    }
}
exports.AddProductionIndexes1721756400000 = AddProductionIndexes1721756400000;
