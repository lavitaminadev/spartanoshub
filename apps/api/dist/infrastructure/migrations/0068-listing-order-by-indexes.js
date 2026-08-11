"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingOrderByIndexes1725400000000 = void 0;
const indexes_1 = require("./helpers/indexes");
const INDEXES = [
    { table: 'crm_opportunities', name: 'IDX_crm_opportunities_org_created', columns: ['organization_id', 'created_at'] },
    { table: 'briefs', name: 'IDX_briefs_org_created', columns: ['organization_id', 'created_at'] },
    { table: 'contracts', name: 'IDX_contracts_org_created', columns: ['organization_id', 'created_at'] },
    { table: 'moodboards', name: 'IDX_moodboards_org_created', columns: ['organization_id', 'created_at'] },
    { table: 'av_sessions', name: 'IDX_av_sessions_org_date', columns: ['organization_id', 'date'] },
    { table: 'quotes', name: 'IDX_quotes_org_created', columns: ['organization_id', 'created_at'] },
    { table: 'charge_notes', name: 'IDX_charge_notes_org_created', columns: ['organization_id', 'created_at'] },
    { table: 'approval_requests', name: 'IDX_approval_requests_org_created', columns: ['organization_id', 'created_at'] },
];
class ListingOrderByIndexes1725400000000 {
    constructor() {
        this.name = 'ListingOrderByIndexes1725400000000';
    }
    async up(queryRunner) {
        await (0, indexes_1.ensureIndexes)(queryRunner, INDEXES);
    }
    async down(queryRunner) {
        await (0, indexes_1.dropIndexes)(queryRunner, INDEXES);
    }
}
exports.ListingOrderByIndexes1725400000000 = ListingOrderByIndexes1725400000000;
//# sourceMappingURL=0068-listing-order-by-indexes.js.map