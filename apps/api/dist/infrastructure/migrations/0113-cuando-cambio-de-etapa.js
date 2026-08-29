"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuandoCambioDeEtapa1756500000000 = void 0;
class CuandoCambioDeEtapa1756500000000 {
    constructor() {
        this.name = 'CuandoCambioDeEtapa1756500000000';
    }
    async up(queryRunner) {
        const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'leads' AND column_name = 'stage_changed_at'
    `);
        if (Number(columnas?.[0]?.n ?? 0) > 0)
            return;
        await queryRunner.query('ALTER TABLE leads ADD COLUMN stage_changed_at TIMESTAMP NULL');
        await queryRunner.query(`
      UPDATE leads l
      SET l.stage_changed_at = (
        SELECT MAX(c.created_at) FROM process_stage_changes c
        WHERE c.subject_type = 'lead' AND c.subject_id = l.id
      )
    `);
        await queryRunner.query('UPDATE leads SET stage_changed_at = created_at WHERE stage_changed_at IS NULL');
        await queryRunner.query('ALTER TABLE leads ADD COLUMN idle_alerted_level VARCHAR(10) NULL');
        await queryRunner.query('CREATE INDEX IDX_leads_org_stage_changed ON leads (organization_id, status, stage_changed_at)');
    }
    async down(queryRunner) {
        const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'leads' AND column_name = 'stage_changed_at'
    `);
        if (Number(columnas?.[0]?.n ?? 0) === 0)
            return;
        await queryRunner.query('DROP INDEX IDX_leads_org_stage_changed ON leads');
        await queryRunner.query('ALTER TABLE leads DROP COLUMN idle_alerted_level');
        await queryRunner.query('ALTER TABLE leads DROP COLUMN stage_changed_at');
    }
}
exports.CuandoCambioDeEtapa1756500000000 = CuandoCambioDeEtapa1756500000000;
