"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddGa4MeasurementId1724247400000 = void 0;
const typeorm_1 = require("typeorm");
class AddGa4MeasurementId1724247400000 {
    constructor() {
        this.name = 'AddGa4MeasurementId1724247400000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasColumn('reservation_forms', 'ga4_measurement_id'))
            return;
        await queryRunner.addColumn('reservation_forms', new typeorm_1.TableColumn({
            name: 'ga4_measurement_id',
            type: 'varchar',
            length: '40',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasColumn('reservation_forms', 'ga4_measurement_id')))
            return;
        await queryRunner.dropColumn('reservation_forms', 'ga4_measurement_id');
    }
}
exports.AddGa4MeasurementId1724247400000 = AddGa4MeasurementId1724247400000;
//# sourceMappingURL=0057-add-ga4-measurement-id.js.map