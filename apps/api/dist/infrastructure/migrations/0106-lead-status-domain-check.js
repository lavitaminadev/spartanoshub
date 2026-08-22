"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadStatusDomainCheck1756000001000 = void 0;
class LeadStatusDomainCheck1756000001000 {
    constructor() {
        this.name = 'LeadStatusDomainCheck1756000001000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      UPDATE leads SET status = 'attended'
      WHERE domain = 'audience' AND status = 'won'
    `);
        await queryRunner.query(`
      UPDATE leads SET status = 'new'
      WHERE domain = 'audience'
        AND status NOT IN ('new', 'reserved', 'attended', 'no_show', 'lost')
    `);
        await queryRunner.query(`
      UPDATE leads SET status = 'new'
      WHERE domain = 'commercial'
        AND status NOT IN ('new', 'contacted', 'quote_sent', 'meeting_scheduled',
                           'visited', 'negotiation', 'won', 'lost')
    `);
        const existe = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.table_constraints
      WHERE table_schema = DATABASE() AND table_name = 'leads'
        AND constraint_name = 'CHK_leads_status_domain'
    `);
        if (Number(existe?.[0]?.n ?? 0) > 0)
            return;
        await queryRunner.query(`
      ALTER TABLE leads ADD CONSTRAINT CHK_leads_status_domain CHECK (
        (domain = 'audience'
          AND status IN ('new', 'reserved', 'attended', 'no_show', 'lost'))
        OR
        (domain = 'commercial'
          AND status IN ('new', 'contacted', 'quote_sent', 'meeting_scheduled',
                         'visited', 'negotiation', 'won', 'lost'))
      )
    `);
    }
    async down(queryRunner) {
        const existe = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.table_constraints
      WHERE table_schema = DATABASE() AND table_name = 'leads'
        AND constraint_name = 'CHK_leads_status_domain'
    `);
        if (Number(existe?.[0]?.n ?? 0) === 0)
            return;
        await queryRunner.query('ALTER TABLE leads DROP CONSTRAINT CHK_leads_status_domain');
    }
}
exports.LeadStatusDomainCheck1756000001000 = LeadStatusDomainCheck1756000001000;
