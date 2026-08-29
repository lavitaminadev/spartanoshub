"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NombreDelFormulario1757000000000 = void 0;
class NombreDelFormulario1757000000000 {
    constructor() {
        this.name = 'NombreDelFormulario1757000000000';
    }
    async up(queryRunner) {
        const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'leads' AND column_name = 'external_form_name'
    `);
        if (Number(columnas?.[0]?.n ?? 0) > 0)
            return;
        await queryRunner.query('ALTER TABLE leads ADD COLUMN external_form_name VARCHAR(255) NULL');
        await queryRunner.query(`
      UPDATE leads
      SET external_form_name = JSON_VALUE(metadata, '$.formName')
      WHERE metadata IS NOT NULL AND JSON_VALUE(metadata, '$.formName') IS NOT NULL
    `);
        await queryRunner.query('CREATE INDEX IDX_leads_org_form_name ON leads (organization_id, external_form_name)');
    }
    async down(queryRunner) {
        const columnas = await queryRunner.query(`
      SELECT COUNT(*) AS n FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = 'leads' AND column_name = 'external_form_name'
    `);
        if (Number(columnas?.[0]?.n ?? 0) === 0)
            return;
        await queryRunner.query('DROP INDEX IDX_leads_org_form_name ON leads');
        await queryRunner.query('ALTER TABLE leads DROP COLUMN external_form_name');
    }
}
exports.NombreDelFormulario1757000000000 = NombreDelFormulario1757000000000;
