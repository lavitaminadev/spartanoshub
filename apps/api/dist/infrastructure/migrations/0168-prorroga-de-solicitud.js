"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProrrogaDeSolicitud1790000000168 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class ProrrogaDeSolicitud1790000000168 {
    constructor() {
        this.name = 'ProrrogaDeSolicitud1790000000168';
        this.columnas = [
            ['extended_until', 'TIMESTAMP NULL'],
            ['extended_reason', 'VARCHAR(300) NULL'],
        ];
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('service_requests')))
            return;
        for (const [columna, tipo] of this.columnas) {
            if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'service_requests', columna))) {
                await queryRunner.query(`ALTER TABLE service_requests ADD COLUMN ${columna} ${tipo}`);
            }
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('service_requests')))
            return;
        for (const [columna] of [...this.columnas].reverse()) {
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'service_requests', columna)) {
                await queryRunner.query(`ALTER TABLE service_requests DROP COLUMN ${columna}`);
            }
        }
    }
}
exports.ProrrogaDeSolicitud1790000000168 = ProrrogaDeSolicitud1790000000168;
