"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadDomain1725500000000 = void 0;
const typeorm_1 = require("typeorm");
class LeadDomain1725500000000 {
    constructor() {
        this.name = 'LeadDomain1725500000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('leads', 'domain'))) {
            await queryRunner.addColumn('leads', new typeorm_1.TableColumn({
                name: 'domain',
                type: 'varchar',
                length: '20',
                default: "'commercial'",
                isNullable: false,
            }));
        }
        await queryRunner.query(`UPDATE leads SET domain = 'audience' WHERE source = 'vitahub_reservations'`);
        const indexExists = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'leads' AND index_name = 'IDX_leads_org_domain'`);
        if (Number(indexExists?.[0]?.total ?? 0) === 0) {
            await queryRunner.query('CREATE INDEX IDX_leads_org_domain ON leads (organization_id, domain)');
        }
    }
    async down(queryRunner) {
        const indexExists = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.statistics
       WHERE table_schema = DATABASE() AND table_name = 'leads' AND index_name = 'IDX_leads_org_domain'`);
        if (Number(indexExists?.[0]?.total ?? 0) > 0) {
            await queryRunner.query('DROP INDEX IDX_leads_org_domain ON leads');
        }
        if (await queryRunner.hasColumn('leads', 'domain')) {
            await queryRunner.dropColumn('leads', 'domain');
        }
    }
}
exports.LeadDomain1725500000000 = LeadDomain1725500000000;
//# sourceMappingURL=0069-lead-domain.js.map