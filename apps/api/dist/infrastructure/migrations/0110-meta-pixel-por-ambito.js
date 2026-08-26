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
            if (!(await queryRunner.hasColumn(tabla, 'meta_pixel_id'))) {
                await queryRunner.addColumn(tabla, this.columna());
            }
        }
        if (await queryRunner.hasTable('crm_campaigns')
            && !(await queryRunner.hasColumn('crm_campaigns', 'meta_capi_enabled'))) {
            await queryRunner.addColumn('crm_campaigns', new typeorm_1.TableColumn({
                name: 'meta_capi_enabled', type: 'boolean', isNullable: false, default: true,
            }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('crm_campaigns')
            && await queryRunner.hasColumn('crm_campaigns', 'meta_capi_enabled')) {
            await queryRunner.dropColumn('crm_campaigns', 'meta_capi_enabled');
        }
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
