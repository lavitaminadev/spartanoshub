"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RespuestasPorPeriodo1790000000176 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class RespuestasPorPeriodo1790000000176 {
    constructor() {
        this.name = 'RespuestasPorPeriodo1790000000176';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('survey_responses')))
            return;
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'survey_responses', 'IDX_survey_response_survey_fecha'))) {
            await queryRunner.query('CREATE INDEX IDX_survey_response_survey_fecha ON survey_responses (survey_id, submitted_at)');
        }
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'survey_responses', 'IDX_survey_response_survey')) {
            try {
                await queryRunner.query('DROP INDEX IDX_survey_response_survey ON survey_responses');
            }
            catch (error) {
                console.warn('[migration 0176] No se pudo quitar IDX_survey_response_survey: '
                    + `${error instanceof Error ? error.message : error}. `
                    + 'Quedan dos índices sobre survey_responses; el nuevo ya sirve, el viejo sólo cuesta escritura. '
                    + 'Revisar si alguna llave foránea lo está reteniendo y quitarlo a mano.');
            }
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('survey_responses')))
            return;
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'survey_responses', 'IDX_survey_response_survey'))) {
            await queryRunner.query('CREATE INDEX IDX_survey_response_survey ON survey_responses (survey_id)');
        }
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'survey_responses', 'IDX_survey_response_survey_fecha')) {
            await queryRunner.query('DROP INDEX IDX_survey_response_survey_fecha ON survey_responses');
        }
    }
}
exports.RespuestasPorPeriodo1790000000176 = RespuestasPorPeriodo1790000000176;
