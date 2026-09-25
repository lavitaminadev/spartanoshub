"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReglasDeCalificacion1790000000154 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class ReglasDeCalificacion1790000000154 {
    constructor() {
        this.name = 'ReglasDeCalificacion1790000000154';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('crm_reglas_de_calificacion'))) {
            await queryRunner.query(`
        CREATE TABLE crm_reglas_de_calificacion (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          organization_id VARCHAR(36) NOT NULL,
          client_id VARCHAR(36) NOT NULL,
          nombre VARCHAR(120) NOT NULL,
          posicion INT NOT NULL DEFAULT 0,
          activa TINYINT(1) NOT NULL DEFAULT 1,
          -- Nace en manual: se prueba sobre unos pocos leads antes de dejarla correr sola.
          automatica TINYINT(1) NOT NULL DEFAULT 0,
          unir VARCHAR(10) NOT NULL DEFAULT 'todas',
          condiciones JSON NULL,
          acciones JSON NULL,
          created_by VARCHAR(36) NULL,
          archived_at TIMESTAMP NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          /*
            La única consulta que existe: las reglas vivas de una empresa, en orden. Se lee en
            cada lead que entra, así que el índice la resuelve entera sin tocar la tabla.
          */
          INDEX IDX_crm_reglas_org_client (organization_id, client_id, archived_at, posicion)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
        }
        if (!(await queryRunner.hasTable('leads')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'leads', 'regla_aplicada_id'))) {
            await queryRunner.query('ALTER TABLE leads ADD COLUMN regla_aplicada_id VARCHAR(36) NULL');
        }
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'leads', 'regla_aplicada_motivo'))) {
            await queryRunner.query('ALTER TABLE leads ADD COLUMN regla_aplicada_motivo VARCHAR(300) NULL');
        }
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'leads', 'IDX_leads_org_client_created'))) {
            await queryRunner.query('CREATE INDEX IDX_leads_org_client_created ON leads (organization_id, client_id, created_at)');
        }
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'leads', 'IDX_leads_regla_aplicada'))) {
            await queryRunner.query('CREATE INDEX IDX_leads_regla_aplicada ON leads (organization_id, regla_aplicada_id)');
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('leads')) {
            if (await (0, catalogo_1.hayIndice)(queryRunner, 'leads', 'IDX_leads_regla_aplicada')) {
                await queryRunner.query('DROP INDEX IDX_leads_regla_aplicada ON leads');
            }
            if (await (0, catalogo_1.hayIndice)(queryRunner, 'leads', 'IDX_leads_org_client_created')) {
                await queryRunner.query('DROP INDEX IDX_leads_org_client_created ON leads');
            }
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'leads', 'regla_aplicada_motivo')) {
                await queryRunner.query('ALTER TABLE leads DROP COLUMN regla_aplicada_motivo');
            }
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'leads', 'regla_aplicada_id')) {
                await queryRunner.query('ALTER TABLE leads DROP COLUMN regla_aplicada_id');
            }
        }
        await queryRunner.query('DROP TABLE IF EXISTS crm_reglas_de_calificacion');
    }
}
exports.ReglasDeCalificacion1790000000154 = ReglasDeCalificacion1790000000154;
