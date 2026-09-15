"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistorialEncuestasYPermisoDeMedicion1789900000000 = void 0;
const typeorm_1 = require("typeorm");
class HistorialEncuestasYPermisoDeMedicion1789900000000 {
    constructor() {
        this.name = 'HistorialEncuestasYPermisoDeMedicion1789900000000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('surveys') && !(await queryRunner.hasColumn('surveys', 'change_log'))) {
            await queryRunner.addColumn('surveys', new typeorm_1.TableColumn({ name: 'change_log', type: 'json', isNullable: true }));
        }
        if (!(await queryRunner.hasColumn('reservations', 'measurement_consent_version'))) {
            await queryRunner.addColumn('reservations', new typeorm_1.TableColumn({ name: 'measurement_consent_version', type: 'varchar', length: '30', isNullable: true }));
        }
        if (!(await queryRunner.hasColumn('reservations', 'measurement_consent_text'))) {
            await queryRunner.addColumn('reservations', new typeorm_1.TableColumn({ name: 'measurement_consent_text', type: 'text', isNullable: true }));
        }
    }
    async down(queryRunner) {
        for (const [tabla, columna] of [['reservations', 'measurement_consent_text'], ['reservations', 'measurement_consent_version'], ['surveys', 'change_log']]) {
            if (await queryRunner.hasColumn(tabla, columna))
                await queryRunner.dropColumn(tabla, columna);
        }
    }
}
exports.HistorialEncuestasYPermisoDeMedicion1789900000000 = HistorialEncuestasYPermisoDeMedicion1789900000000;
