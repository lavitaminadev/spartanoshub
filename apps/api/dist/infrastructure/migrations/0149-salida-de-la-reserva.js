"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SalidaDeLaReserva1790000000149 = void 0;
const typeorm_1 = require("typeorm");
class SalidaDeLaReserva1790000000149 {
    constructor() {
        this.name = 'SalidaDeLaReserva1790000000149';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        const tabla = await queryRunner.getTable('reservations');
        if (!tabla?.findColumnByName('left_at')) {
            await queryRunner.addColumn('reservations', new typeorm_1.TableColumn({ name: 'left_at', type: 'timestamp', isNullable: true }));
        }
        if (!tabla?.findColumnByName('departure_source')) {
            await queryRunner.addColumn('reservations', new typeorm_1.TableColumn({ name: 'departure_source', type: 'varchar', length: '20', isNullable: true }));
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        const tabla = await queryRunner.getTable('reservations');
        if (tabla?.findColumnByName('departure_source'))
            await queryRunner.dropColumn('reservations', 'departure_source');
        if (tabla?.findColumnByName('left_at'))
            await queryRunner.dropColumn('reservations', 'left_at');
    }
}
exports.SalidaDeLaReserva1790000000149 = SalidaDeLaReserva1790000000149;
