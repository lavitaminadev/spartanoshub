"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurveyClientScope1756000003000 = void 0;
const typeorm_1 = require("typeorm");
class SurveyClientScope1756000003000 {
    constructor() {
        this.name = 'SurveyClientScope1756000003000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('surveys', 'client_id'))) {
            await queryRunner.addColumn('surveys', new typeorm_1.TableColumn({ name: 'client_id', type: 'varchar', length: '36', isNullable: true }));
        }
        const table = await queryRunner.getTable('surveys');
        if (table && !table.indices.some((index) => index.name === 'IDX_survey_org_client')) {
            await queryRunner.createIndex('surveys', new typeorm_1.TableIndex({ name: 'IDX_survey_org_client', columnNames: ['organization_id', 'client_id'] }));
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('surveys');
        if (table?.indices.some((index) => index.name === 'IDX_survey_org_client'))
            await queryRunner.dropIndex('surveys', 'IDX_survey_org_client');
        if (await queryRunner.hasColumn('surveys', 'client_id'))
            await queryRunner.dropColumn('surveys', 'client_id');
    }
}
exports.SurveyClientScope1756000003000 = SurveyClientScope1756000003000;
