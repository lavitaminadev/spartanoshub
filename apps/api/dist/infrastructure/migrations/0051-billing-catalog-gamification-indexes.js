"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingCatalogGamificationIndexes1721756500000 = void 0;
const indexes_1 = require("./helpers/indexes");
const INDEXES = [
    { table: 'invoices', name: 'IDX_invoices_org_status', columns: ['organization_id', 'status'] },
    { table: 'invoices', name: 'IDX_invoices_org_issued', columns: ['organization_id', 'issued_at'] },
    { table: 'invoices', name: 'IDX_invoices_org_client', columns: ['organization_id', 'client_id'] },
    { table: 'quotes', name: 'IDX_quotes_org_status', columns: ['organization_id', 'status'] },
    { table: 'quotes', name: 'IDX_quotes_org_client', columns: ['organization_id', 'client_id'] },
    { table: 'charge_notes', name: 'IDX_charge_notes_org_status', columns: ['organization_id', 'status'] },
    { table: 'charge_notes', name: 'IDX_charge_notes_org_client', columns: ['organization_id', 'client_id'] },
    { table: 'monthly_reports', name: 'IDX_monthly_reports_org_status', columns: ['organization_id', 'status'] },
    { table: 'xp_periods', name: 'IDX_xp_periods_org_user', columns: ['organization_id', 'user_id'] },
    { table: 'xp_periods', name: 'IDX_xp_periods_org_week', columns: ['organization_id', 'week_start'] },
    { table: 'xp_events', name: 'IDX_xp_events_period', columns: ['xp_period_id'] },
    { table: 'xp_events', name: 'IDX_xp_events_user', columns: ['user_id'] },
];
class BillingCatalogGamificationIndexes1721756500000 {
    constructor() {
        this.name = 'BillingCatalogGamificationIndexes1721756500000';
    }
    async up(queryRunner) {
        await (0, indexes_1.ensureIndexes)(queryRunner, INDEXES);
    }
    async down(queryRunner) {
        await (0, indexes_1.dropIndexes)(queryRunner, INDEXES);
    }
}
exports.BillingCatalogGamificationIndexes1721756500000 = BillingCatalogGamificationIndexes1721756500000;
//# sourceMappingURL=0051-billing-catalog-gamification-indexes.js.map