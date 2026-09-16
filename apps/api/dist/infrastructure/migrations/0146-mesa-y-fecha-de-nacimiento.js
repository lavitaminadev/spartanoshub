"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MesaYFechaDeNacimiento1790000000146 = void 0;
const typeorm_1 = require("typeorm");
class MesaYFechaDeNacimiento1790000000146 {
    constructor() {
        this.name = 'MesaYFechaDeNacimiento1790000000146';
        this.columnas = [
            new typeorm_1.TableColumn({ name: 'table_label', type: 'varchar', length: '40', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'birth_date', type: 'date', isNullable: true }),
        ];
    }
    async up(queryRunner) {
        for (const columna of this.columnas) {
            if (!(await queryRunner.hasColumn('reservations', columna.name))) {
                await queryRunner.addColumn('reservations', columna);
            }
        }
    }
    async down(queryRunner) {
        for (const columna of ['birth_date', 'table_label']) {
            if (await queryRunner.hasColumn('reservations', columna))
                await queryRunner.dropColumn('reservations', columna);
        }
    }
}
exports.MesaYFechaDeNacimiento1790000000146 = MesaYFechaDeNacimiento1790000000146;
