"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaducidadDeLoPrestadoYBajasConConstancia1790000000183 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class CaducidadDeLoPrestadoYBajasConConstancia1790000000183 {
    constructor() {
        this.name = 'CaducidadDeLoPrestadoYBajasConConstancia1790000000183';
    }
    async up(queryRunner) {
        for (const [tabla, columna, tipo] of CaducidadDeLoPrestadoYBajasConConstancia1790000000183.COLUMNAS) {
            if (!(await queryRunner.hasTable(tabla)))
                continue;
            if (!(await (0, catalogo_1.hayColumna)(queryRunner, tabla, columna))) {
                await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo}`);
            }
        }
    }
    async down(queryRunner) {
        for (const [tabla, columna] of [...CaducidadDeLoPrestadoYBajasConConstancia1790000000183.COLUMNAS].reverse()) {
            if (await queryRunner.hasTable(tabla) && await (0, catalogo_1.hayColumna)(queryRunner, tabla, columna)) {
                await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
            }
        }
    }
}
exports.CaducidadDeLoPrestadoYBajasConConstancia1790000000183 = CaducidadDeLoPrestadoYBajasConConstancia1790000000183;
CaducidadDeLoPrestadoYBajasConConstancia1790000000183.COLUMNAS = [
    ['user_client_access', 'expires_at', 'TIMESTAMP NULL'],
    ['user_client_access', 'expiry_notified_at', 'TIMESTAMP NULL'],
    ['user_action_overrides', 'expires_at', 'TIMESTAMP NULL'],
    ['user_action_overrides', 'expiry_notified_at', 'TIMESTAMP NULL'],
    ['email_suppression', 'activa', 'TINYINT(1) NOT NULL DEFAULT 1'],
    ['email_suppression', 'levantada_el', 'DATETIME NULL'],
    ['email_suppression', 'levantada_origen', 'VARCHAR(80) NULL'],
    ['email_suppression', 'veces_levantada', 'SMALLINT NOT NULL DEFAULT 0'],
];
