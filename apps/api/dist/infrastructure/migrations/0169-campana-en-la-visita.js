"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampanaEnLaVisita1790000000169 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class CampanaEnLaVisita1790000000169 {
    constructor() {
        this.name = 'CampanaEnLaVisita1790000000169';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('survey_visits')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'survey_visits', 'campana'))) {
            await queryRunner.query('ALTER TABLE survey_visits ADD COLUMN campana VARCHAR(60) NULL');
        }
        const indices = await queryRunner.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'survey_visits' AND INDEX_NAME = 'IDX_survey_visits_survey_campana'");
        if (!indices.length) {
            await queryRunner.query('CREATE INDEX IDX_survey_visits_survey_campana ON survey_visits (survey_id, campana)');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('survey_visits')))
            return;
        const indices = await queryRunner.query("SELECT INDEX_NAME FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'survey_visits' AND INDEX_NAME = 'IDX_survey_visits_survey_campana'");
        if (indices.length)
            await queryRunner.query('DROP INDEX IDX_survey_visits_survey_campana ON survey_visits');
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'survey_visits', 'campana')) {
            await queryRunner.query('ALTER TABLE survey_visits DROP COLUMN campana');
        }
    }
}
exports.CampanaEnLaVisita1790000000169 = CampanaEnLaVisita1790000000169;
