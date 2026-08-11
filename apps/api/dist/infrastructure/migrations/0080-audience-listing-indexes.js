"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudienceListingIndexes1726900001000 = void 0;
const indexes_1 = require("./helpers/indexes");
const INDEXES = [
    {
        table: 'leads',
        name: 'idx_org_domain_created',
        columns: ['organization_id', 'domain', 'created_at'],
        definition: '(organization_id, domain, created_at DESC)',
    },
    {
        table: 'leads',
        name: 'idx_org_domain_status',
        columns: ['organization_id', 'domain', 'status'],
    },
];
class AudienceListingIndexes1726900001000 {
    constructor() {
        this.name = 'AudienceListingIndexes1726900001000';
    }
    async up(queryRunner) {
        await (0, indexes_1.ensureIndexes)(queryRunner, INDEXES);
    }
    async down(queryRunner) {
        await (0, indexes_1.dropIndexes)(queryRunner, INDEXES);
    }
}
exports.AudienceListingIndexes1726900001000 = AudienceListingIndexes1726900001000;
//# sourceMappingURL=0080-audience-listing-indexes.js.map