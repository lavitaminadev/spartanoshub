"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PieceCancellation1726900009000 = void 0;
const typeorm_1 = require("typeorm");
class PieceCancellation1726900009000 {
    constructor() {
        this.name = 'PieceCancellation1726900009000';
    }
    async up(queryRunner) {
        const table = await queryRunner.getTable('pieces');
        if (!table)
            return;
        const columnas = [
            new typeorm_1.TableColumn({ name: 'cancel_origin', type: 'varchar', length: '20', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'cancel_reason', type: 'varchar', length: '500', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'cancelled_at', type: 'timestamp', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'cancelled_by', type: 'varchar', length: '36', isNullable: true }),
        ];
        for (const columna of columnas) {
            if (!table.findColumnByName(columna.name))
                await queryRunner.addColumn('pieces', columna);
        }
    }
    async down(queryRunner) {
        const table = await queryRunner.getTable('pieces');
        if (!table)
            return;
        for (const nombre of ['cancel_origin', 'cancel_reason', 'cancelled_at', 'cancelled_by']) {
            if (table.findColumnByName(nombre))
                await queryRunner.dropColumn('pieces', nombre);
        }
    }
}
exports.PieceCancellation1726900009000 = PieceCancellation1726900009000;
