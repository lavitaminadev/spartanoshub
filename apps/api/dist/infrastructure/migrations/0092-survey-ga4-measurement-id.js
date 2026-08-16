"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SurveyGa4MeasurementId1726401200000 = void 0;
const typeorm_1 = require("typeorm");
class SurveyGa4MeasurementId1726401200000 {
    constructor() {
        this.name = 'SurveyGa4MeasurementId1726401200000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('surveys')))
            return;
        if (await queryRunner.hasColumn('surveys', 'ga4_measurement_id'))
            return;
        await queryRunner.addColumn('surveys', new typeorm_1.TableColumn({
            name: 'ga4_measurement_id',
            type: 'varchar',
            length: '40',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('surveys')))
            return;
        if (!(await queryRunner.hasColumn('surveys', 'ga4_measurement_id')))
            return;
        await queryRunner.dropColumn('surveys', 'ga4_measurement_id');
    }
}
exports.SurveyGa4MeasurementId1726401200000 = SurveyGa4MeasurementId1726401200000;
