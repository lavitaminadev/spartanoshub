"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BeneficiosDeLaRed1790000000166 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class BeneficiosDeLaRed1790000000166 {
    constructor() {
        this.name = 'BeneficiosDeLaRed1790000000166';
        this.columnas = [
            ['group_marketing_consent_at', 'TIMESTAMP NULL'],
            ['group_marketing_consent_version', 'VARCHAR(30) NULL'],
            ['group_marketing_consent_text', 'TEXT NULL'],
        ];
        this.enSolicitudes = ['group_marketing_consent_at', 'group_marketing_consent_text'];
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('reservations')) {
            for (const [columna, tipo] of this.columnas) {
                if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', columna))) {
                    await queryRunner.query(`ALTER TABLE reservations ADD COLUMN ${columna} ${tipo}`);
                }
            }
        }
        if (await queryRunner.hasTable('reservation_group_requests')) {
            for (const columna of this.enSolicitudes) {
                if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'reservation_group_requests', columna))) {
                    const tipo = this.columnas.find(([nombre]) => nombre === columna)[1];
                    await queryRunner.query(`ALTER TABLE reservation_group_requests ADD COLUMN ${columna} ${tipo}`);
                }
            }
        }
    }
    async down(queryRunner) {
        for (const tabla of ['reservation_group_requests', 'reservations']) {
            if (!(await queryRunner.hasTable(tabla)))
                continue;
            for (const [columna] of [...this.columnas].reverse()) {
                if (await (0, catalogo_1.hayColumna)(queryRunner, tabla, columna)) {
                    await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
                }
            }
        }
    }
}
exports.BeneficiosDeLaRed1790000000166 = BeneficiosDeLaRed1790000000166;
