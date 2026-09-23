"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hayColumna = hayColumna;
exports.hayIndice = hayIndice;
async function hayColumna(queryRunner, tabla, columna) {
    const filas = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [tabla, columna]);
    return Number(filas[0]?.total ?? 0) > 0;
}
async function hayIndice(queryRunner, tabla, indice) {
    const filas = await queryRunner.query(`SELECT COUNT(*) AS total FROM information_schema.statistics
     WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?`, [tabla, indice]);
    return Number(filas[0]?.total ?? 0) > 0;
}
