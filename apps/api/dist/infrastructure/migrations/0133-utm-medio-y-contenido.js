"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UtmMedioYContenido1758500000000 = void 0;
class UtmMedioYContenido1758500000000 {
    constructor() {
        this.name = 'UtmMedioYContenido1758500000000';
    }
    async existe(queryRunner, tabla, columna) {
        const rows = await queryRunner.query('SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?', [tabla, columna]);
        return Number(rows?.[0]?.n ?? 0) > 0;
    }
    async up(queryRunner) {
        for (const { tabla, columna, tipo } of UtmMedioYContenido1758500000000.COLUMNAS) {
            if (await this.existe(queryRunner, tabla, columna))
                continue;
            await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo} NULL`);
        }
    }
    async down(queryRunner) {
        for (const { tabla, columna } of UtmMedioYContenido1758500000000.COLUMNAS) {
            if (!(await this.existe(queryRunner, tabla, columna)))
                continue;
            await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
        }
    }
}
exports.UtmMedioYContenido1758500000000 = UtmMedioYContenido1758500000000;
UtmMedioYContenido1758500000000.COLUMNAS = [
    { tabla: 'reservation_group_requests', columna: 'utm_medium', tipo: 'varchar(120)' },
    { tabla: 'reservation_group_requests', columna: 'utm_content', tipo: 'varchar(180)' },
    { tabla: 'reservation_form_events', columna: 'utm_medium', tipo: 'varchar(120)' },
    { tabla: 'reservation_form_events', columna: 'utm_content', tipo: 'varchar(180)' },
];
