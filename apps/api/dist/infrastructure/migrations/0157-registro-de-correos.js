"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistroDeCorreos1790000000157 = void 0;
class RegistroDeCorreos1790000000157 {
    constructor() {
        this.name = 'RegistroDeCorreos1790000000157';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('registro_de_correos'))
            return;
        await queryRunner.query(`
      CREATE TABLE registro_de_correos (
        id VARCHAR(36) NOT NULL,
        destinatario VARCHAR(320) NOT NULL,
        asunto VARCHAR(255) NOT NULL,
        resultado VARCHAR(12) NOT NULL,
        motivo VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        INDEX IDX_registro_de_correos_fecha (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('registro_de_correos'))
            await queryRunner.query('DROP TABLE registro_de_correos');
    }
}
exports.RegistroDeCorreos1790000000157 = RegistroDeCorreos1790000000157;
