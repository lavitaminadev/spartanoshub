"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoltarLasTablasRetiradas1790000000179 = void 0;
class SoltarLasTablasRetiradas1790000000179 {
    constructor() {
        this.name = 'SoltarLasTablasRetiradas1790000000179';
    }
    async up(queryRunner) {
        for (const tabla of SoltarLasTablasRetiradas1790000000179.RETIRADAS) {
            if (!(await queryRunner.hasTable(tabla)))
                continue;
            const filas = await queryRunner
                .query(`SELECT COUNT(*) total FROM \`${tabla}\``)
                .catch(() => [{ total: '?' }]);
            console.warn(`[migration 0179] Soltando ${tabla} con ${filas[0]?.total ?? '?'} fila(s). No tiene vuelta atrás.`);
            await queryRunner.query(`DROP TABLE \`${tabla}\``);
        }
    }
    async down(queryRunner) {
        for (const tabla of SoltarLasTablasRetiradas1790000000179.RETIRADAS) {
            if (await queryRunner.hasTable(tabla))
                continue;
            await queryRunner.query(`CREATE TABLE \`${tabla}\` (id VARCHAR(36) NOT NULL PRIMARY KEY)`);
        }
    }
}
exports.SoltarLasTablasRetiradas1790000000179 = SoltarLasTablasRetiradas1790000000179;
SoltarLasTablasRetiradas1790000000179.RETIRADAS = [
    'zz_lead_interactions_retirada',
    'zz_meta_pixels_respaldo_20260928_retirada',
];
