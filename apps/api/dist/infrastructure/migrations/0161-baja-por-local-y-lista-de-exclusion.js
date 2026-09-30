"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BajaPorLocalYListaDeExclusion1790000000161 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class BajaPorLocalYListaDeExclusion1790000000161 {
    constructor() {
        this.name = 'BajaPorLocalYListaDeExclusion1790000000161';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('email_subscribers')) {
            if (await (0, catalogo_1.hayIndice)(queryRunner, 'email_subscribers', 'UQ_email_subscribers_org_email')) {
                await queryRunner.query('DROP INDEX UQ_email_subscribers_org_email ON email_subscribers');
            }
            if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'email_subscribers', 'UQ_email_subscribers_org_client_email'))) {
                await queryRunner.query('CREATE UNIQUE INDEX UQ_email_subscribers_org_client_email ON email_subscribers (organization_id, client_id, email)');
            }
            if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'email_subscribers', 'unsubscribed_scope'))) {
                await queryRunner.query("ALTER TABLE email_subscribers ADD COLUMN unsubscribed_scope VARCHAR(10) NULL");
            }
            if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'email_subscribers', 'unsubscribed_from'))) {
                await queryRunner.query('ALTER TABLE email_subscribers ADD COLUMN unsubscribed_from VARCHAR(80) NULL');
            }
            await queryRunner.query("UPDATE email_subscribers SET unsubscribed_scope = 'local' WHERE status = 'unsubscribed' AND unsubscribed_at IS NOT NULL AND unsubscribed_scope IS NULL");
        }
        if (!(await queryRunner.hasTable('email_suppression'))) {
            await queryRunner.query(`
        CREATE TABLE email_suppression (
          id VARCHAR(36) NOT NULL,
          organization_id VARCHAR(36) NOT NULL,
          client_id VARCHAR(36) NULL,
          huella CHAR(64) NOT NULL,
          alcance VARCHAR(10) NOT NULL,
          origen VARCHAR(80) NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY UQ_email_suppression_org_huella_client (organization_id, huella, client_id),
          INDEX IDX_email_suppression_org_huella (organization_id, huella)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('email_suppression'))
            await queryRunner.query('DROP TABLE email_suppression');
        if (!(await queryRunner.hasTable('email_subscribers')))
            return;
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'email_subscribers', 'unsubscribed_from')) {
            await queryRunner.query('ALTER TABLE email_subscribers DROP COLUMN unsubscribed_from');
        }
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'email_subscribers', 'unsubscribed_scope')) {
            await queryRunner.query('ALTER TABLE email_subscribers DROP COLUMN unsubscribed_scope');
        }
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'email_subscribers', 'UQ_email_subscribers_org_client_email')) {
            await queryRunner.query('DROP INDEX UQ_email_subscribers_org_client_email ON email_subscribers');
        }
    }
}
exports.BajaPorLocalYListaDeExclusion1790000000161 = BajaPorLocalYListaDeExclusion1790000000161;
