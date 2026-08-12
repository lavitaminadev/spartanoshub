"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationWorkflowState1726900003000 = void 0;
const typeorm_1 = require("typeorm");
class ReservationWorkflowState1726900003000 {
    constructor() {
        this.name = 'ReservationWorkflowState1726900003000';
    }
    async up(queryRunner) {
        const table = await queryRunner.getTable('reservations');
        if (!table || table.findColumnByName('workflow_state'))
            return;
        await queryRunner.addColumn('reservations', new typeorm_1.TableColumn({
            name: 'workflow_state', type: 'varchar', length: '20', isNullable: false, default: "'draft'",
        }));
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('reservations');
        if (table?.findColumnByName('workflow_state'))
            await queryRunner.dropColumn('reservations', 'workflow_state');
    }
}
exports.ReservationWorkflowState1726900003000 = ReservationWorkflowState1726900003000;
