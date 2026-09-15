"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AceptacionContratoDeEncargo1790000000000 = void 0;
const typeorm_1 = require("typeorm");
class AceptacionContratoDeEncargo1790000000000 {
    constructor() {
        this.name = 'AceptacionContratoDeEncargo1790000000000';
    }
    async up(queryRunner) {
        const columnas = [
            new typeorm_1.TableColumn({ name: 'encargo_version', type: 'varchar', length: '40', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'encargo_accepted_at', type: 'timestamp', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'encargo_accepted_by', type: 'varchar', length: '36', isNullable: true }),
            new typeorm_1.TableColumn({ name: 'encargo_accepted_name', type: 'varchar', length: '180', isNullable: true }),
        ];
        for (const columna of columnas) {
            if (!(await queryRunner.hasColumn('clients', columna.name)))
                await queryRunner.addColumn('clients', columna);
        }
        if (!(await queryRunner.hasColumn('reservations', 'sensitive_consent_at'))) {
            await queryRunner.addColumn('reservations', new typeorm_1.TableColumn({ name: 'sensitive_consent_at', type: 'timestamp', isNullable: true }));
        }
        if (!(await queryRunner.hasColumn('reservations', 'sensitive_consent_text'))) {
            await queryRunner.addColumn('reservations', new typeorm_1.TableColumn({ name: 'sensitive_consent_text', type: 'text', isNullable: true }));
        }
    }
    async down(queryRunner) {
        for (const columna of ['sensitive_consent_text', 'sensitive_consent_at']) {
            if (await queryRunner.hasColumn('reservations', columna))
                await queryRunner.dropColumn('reservations', columna);
        }
        for (const columna of ['encargo_accepted_name', 'encargo_accepted_by', 'encargo_accepted_at', 'encargo_version']) {
            if (await queryRunner.hasColumn('clients', columna))
                await queryRunner.dropColumn('clients', columna);
        }
    }
}
exports.AceptacionContratoDeEncargo1790000000000 = AceptacionContratoDeEncargo1790000000000;
