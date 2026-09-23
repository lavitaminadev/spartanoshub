"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreguntasDeMetaPorCampo1790000000150 = void 0;
const typeorm_1 = require("typeorm");
class PreguntasDeMetaPorCampo1790000000150 {
    constructor() {
        this.name = 'PreguntasDeMetaPorCampo1790000000150';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('crm_field_definitions')))
            return;
        const tabla = await queryRunner.getTable('crm_field_definitions');
        if (!tabla?.findColumnByName('meta_questions')) {
            await queryRunner.addColumn('crm_field_definitions', new typeorm_1.TableColumn({
                name: 'meta_questions', type: 'json', isNullable: true,
            }));
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('crm_field_definitions')))
            return;
        const tabla = await queryRunner.getTable('crm_field_definitions');
        if (tabla?.findColumnByName('meta_questions'))
            await queryRunner.dropColumn('crm_field_definitions', 'meta_questions');
    }
}
exports.PreguntasDeMetaPorCampo1790000000150 = PreguntasDeMetaPorCampo1790000000150;
