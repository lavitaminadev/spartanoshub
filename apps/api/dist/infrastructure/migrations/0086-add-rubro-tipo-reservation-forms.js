"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRubroTipoToReservationForms0086 = void 0;
const typeorm_1 = require("typeorm");
class AddRubroTipoToReservationForms0086 {
    constructor() {
        this.name = 'AddRubroTipoToReservationForms0086';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('reservation_forms', 'rubro'))) {
            await queryRunner.addColumn('reservation_forms', new typeorm_1.TableColumn({ name: 'rubro', type: 'varchar', length: '60', isNullable: true }));
        }
        if (!(await queryRunner.hasColumn('reservation_forms', 'tipo'))) {
            await queryRunner.addColumn('reservation_forms', new typeorm_1.TableColumn({ name: 'tipo', type: 'varchar', length: '60', isNullable: true }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('reservation_forms', 'rubro'))
            await queryRunner.dropColumn('reservation_forms', 'rubro');
        if (await queryRunner.hasColumn('reservation_forms', 'tipo'))
            await queryRunner.dropColumn('reservation_forms', 'tipo');
    }
}
exports.AddRubroTipoToReservationForms0086 = AddRubroTipoToReservationForms0086;
