"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotivoDeCierreDeSolicitud1790000000148 = void 0;
const typeorm_1 = require("typeorm");
class MotivoDeCierreDeSolicitud1790000000148 {
    constructor() {
        this.name = 'MotivoDeCierreDeSolicitud1790000000148';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_group_requests')))
            return;
        const tabla = await queryRunner.getTable('reservation_group_requests');
        if (!tabla?.findColumnByName('close_reason')) {
            await queryRunner.addColumn('reservation_group_requests', new typeorm_1.TableColumn({
                name: 'close_reason', type: 'varchar', length: '40', isNullable: true,
            }));
        }
        if (!tabla?.findColumnByName('close_notes')) {
            await queryRunner.addColumn('reservation_group_requests', new typeorm_1.TableColumn({
                name: 'close_notes', type: 'text', isNullable: true,
            }));
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservation_group_requests')))
            return;
        const tabla = await queryRunner.getTable('reservation_group_requests');
        if (tabla?.findColumnByName('close_notes'))
            await queryRunner.dropColumn('reservation_group_requests', 'close_notes');
        if (tabla?.findColumnByName('close_reason'))
            await queryRunner.dropColumn('reservation_group_requests', 'close_reason');
    }
}
exports.MotivoDeCierreDeSolicitud1790000000148 = MotivoDeCierreDeSolicitud1790000000148;
