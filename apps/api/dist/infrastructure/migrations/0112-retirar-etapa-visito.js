"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetirarEtapaVisito1756400000000 = void 0;
class RetirarEtapaVisito1756400000000 {
    constructor() {
        this.name = 'RetirarEtapaVisito1756400000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`
      UPDATE leads SET status = 'negotiation'
      WHERE domain = 'commercial' AND status = 'visited'
    `);
        const existe = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.table_constraints
      WHERE table_schema = DATABASE() AND table_name = 'leads'
        AND constraint_name = 'CHK_leads_status_domain'
    `);
        if (Number(existe?.[0]?.n ?? 0) > 0) {
            await queryRunner.query('ALTER TABLE leads DROP CONSTRAINT CHK_leads_status_domain');
        }
        await queryRunner.query(`
      ALTER TABLE leads ADD CONSTRAINT CHK_leads_status_domain CHECK (
        (domain = 'audience'
          AND status IN ('new', 'reserved', 'attended', 'no_show', 'lost'))
        OR
        (domain = 'commercial'
          AND status IN ('new', 'contacted', 'quote_sent', 'meeting_scheduled',
                         'negotiation', 'won', 'lost'))
      )
    `);
    }
    async down(queryRunner) {
        const existe = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.table_constraints
      WHERE table_schema = DATABASE() AND table_name = 'leads'
        AND constraint_name = 'CHK_leads_status_domain'
    `);
        if (Number(existe?.[0]?.n ?? 0) > 0) {
            await queryRunner.query('ALTER TABLE leads DROP CONSTRAINT CHK_leads_status_domain');
        }
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
}
exports.RetirarEtapaVisito1756400000000 = RetirarEtapaVisito1756400000000;
