"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetaPixelPorAmbito1756200000110 = void 0;
const typeorm_1 = require("typeorm");
class MetaPixelPorAmbito1756200000110 {
    constructor() {
        this.name = 'MetaPixelPorAmbito1756200000110';
        this.objetivos = ['reservation_forms', 'crm_campaigns'];
    }
    columna() {
        return new typeorm_1.TableColumn({ name: 'meta_pixel_id', type: 'varchar', length: '40', isNullable: true });
    }
    async up(queryRunner) {
        for (const tabla of this.objetivos) {
            if (!(await queryRunner.hasTable(tabla)))
                continue;
            if (await queryRunner.hasColumn(tabla, 'meta_pixel_id'))
                continue;
            await queryRunner.addColumn(tabla, this.columna());
        }
    }
    async down(queryRunner) {
        for (const tabla of this.objetivos) {
            if (!(await queryRunner.hasTable(tabla)))
                continue;
            if (!(await queryRunner.hasColumn(tabla, 'meta_pixel_id')))
                continue;
            await queryRunner.dropColumn(tabla, 'meta_pixel_id');
        }
    }
}
exports.MetaPixelPorAmbito1756200000110 = MetaPixelPorAmbito1756200000110;
