"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminarLasAnonimizacionesAMedias1790000000181 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class TerminarLasAnonimizacionesAMedias1790000000181 {
    constructor() {
        this.name = 'TerminarLasAnonimizacionesAMedias1790000000181';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        const presentes = [];
        for (const columna of TerminarLasAnonimizacionesAMedias1790000000181.COLUMNAS) {
            if (await (0, catalogo_1.hayColumna)(queryRunner, 'reservations', columna))
                presentes.push(columna);
        }
        if (!presentes.length)
            return;
        const asignaciones = presentes.map((columna) => `${columna} = NULL`).join(', ');
        const pendientes = presentes.map((columna) => `${columna} IS NOT NULL`).join(' OR ');
        for (;;) {
            const resultado = await queryRunner.query(`UPDATE reservations SET ${asignaciones}`
                + " WHERE guest_name LIKE 'Visitante anonimizado %'"
                + ` AND (${pendientes}) LIMIT 2000`);
            if (!resultado?.affectedRows)
                return;
        }
    }
    async down() {
        return undefined;
    }
}
exports.TerminarLasAnonimizacionesAMedias1790000000181 = TerminarLasAnonimizacionesAMedias1790000000181;
TerminarLasAnonimizacionesAMedias1790000000181.COLUMNAS = [
    'birth_date',
    'guest_document',
    'guest_document_type',
    'guest_document_country',
    'fbclid',
    'gclid',
    'gbraid',
    'wbraid',
    'click_id',
];
