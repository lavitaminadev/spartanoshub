"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsentimientoDeRed1758600000000 = void 0;
class ConsentimientoDeRed1758600000000 {
    constructor() {
        this.name = 'ConsentimientoDeRed1758600000000';
    }
    async existe(queryRunner, tabla, columna) {
        const rows = await queryRunner.query('SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?', [tabla, columna]);
        return Number(rows?.[0]?.n ?? 0) > 0;
    }
    async up(queryRunner) {
        for (const { tabla, columna, tipo } of ConsentimientoDeRed1758600000000.COLUMNAS) {
            if (await this.existe(queryRunner, tabla, columna))
                continue;
            await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo} NULL`);
        }
    }
    async down(queryRunner) {
        for (const { tabla, columna } of ConsentimientoDeRed1758600000000.COLUMNAS) {
            if (!(await this.existe(queryRunner, tabla, columna)))
                continue;
            await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
        }
    }
}
exports.ConsentimientoDeRed1758600000000 = ConsentimientoDeRed1758600000000;
ConsentimientoDeRed1758600000000.COLUMNAS = [
    { tabla: 'reservations', columna: 'network_consent_at', tipo: 'timestamp' },
    { tabla: 'reservations', columna: 'network_consent_version', tipo: 'varchar(30)' },
    { tabla: 'reservations', columna: 'network_consent_text', tipo: 'text' },
    { tabla: 'reservation_group_requests', columna: 'network_consent_at', tipo: 'timestamp' },
    { tabla: 'reservation_group_requests', columna: 'network_consent_text', tipo: 'text' },
];
