"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TablasQueYaNadieEscribe1790000000173 = void 0;
class TablasQueYaNadieEscribe1790000000173 {
    constructor() {
        this.name = 'TablasQueYaNadieEscribe1790000000173';
    }
    async up(queryRunner) {
        for (const [vigente, retirada] of TablasQueYaNadieEscribe1790000000173.RETIRADAS) {
            if (!(await queryRunner.hasTable(vigente)))
                continue;
            if (await queryRunner.hasTable(retirada))
                continue;
            await queryRunner.query(`RENAME TABLE \`${vigente}\` TO \`${retirada}\``);
        }
    }
    async down(queryRunner) {
        for (const [vigente, retirada] of TablasQueYaNadieEscribe1790000000173.RETIRADAS) {
            if (!(await queryRunner.hasTable(retirada)))
                continue;
            if (await queryRunner.hasTable(vigente))
                continue;
            await queryRunner.query(`RENAME TABLE \`${retirada}\` TO \`${vigente}\``);
        }
    }
}
exports.TablasQueYaNadieEscribe1790000000173 = TablasQueYaNadieEscribe1790000000173;
TablasQueYaNadieEscribe1790000000173.RETIRADAS = [
    ['lead_interactions', 'zz_lead_interactions_retirada'],
    ['meta_pixels_respaldo_20260928', 'zz_meta_pixels_respaldo_20260928_retirada'],
];
