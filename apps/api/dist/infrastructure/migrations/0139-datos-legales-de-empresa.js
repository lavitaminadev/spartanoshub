"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatosLegalesDeEmpresa1789500000000 = void 0;
const typeorm_1 = require("typeorm");
class DatosLegalesDeEmpresa1789500000000 {
    constructor() {
        this.name = 'DatosLegalesDeEmpresa1789500000000';
    }
    async up(queryRunner) {
        const columnas = [['tax_id', 30], ['privacy_email', 190], ['privacy_url', 500], ['terms_url', 500], ['legal_mode', 10]];
        for (const [nombre, largo] of columnas) {
            if (!(await queryRunner.hasColumn('clients', nombre))) {
                await queryRunner.addColumn('clients', new typeorm_1.TableColumn({ name: nombre, type: 'varchar', length: String(largo), isNullable: true }));
            }
        }
        for (const nombre of ['privacy_text', 'terms_text']) {
            if (!(await queryRunner.hasColumn('clients', nombre))) {
                await queryRunner.addColumn('clients', new typeorm_1.TableColumn({ name: nombre, type: 'text', isNullable: true }));
            }
        }
    }
    async down(queryRunner) {
        for (const nombre of ['terms_text', 'privacy_text', 'legal_mode', 'terms_url', 'privacy_url', 'privacy_email', 'tax_id']) {
            if (await queryRunner.hasColumn('clients', nombre))
                await queryRunner.dropColumn('clients', nombre);
        }
    }
}
exports.DatosLegalesDeEmpresa1789500000000 = DatosLegalesDeEmpresa1789500000000;
