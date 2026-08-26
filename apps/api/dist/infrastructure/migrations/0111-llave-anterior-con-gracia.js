"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LlaveAnteriorConGracia1756300000111 = void 0;
const typeorm_1 = require("typeorm");
class LlaveAnteriorConGracia1756300000111 {
    constructor() {
        this.name = 'LlaveAnteriorConGracia1756300000111';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('lead_ingest_sources')))
            return;
        if (!(await queryRunner.hasColumn('lead_ingest_sources', 'previous_token_hash'))) {
            await queryRunner.addColumn('lead_ingest_sources', new typeorm_1.TableColumn({
                name: 'previous_token_hash', type: 'varchar', length: '64', isNullable: true,
            }));
        }
        if (!(await queryRunner.hasColumn('lead_ingest_sources', 'previous_token_expires_at'))) {
            await queryRunner.addColumn('lead_ingest_sources', new typeorm_1.TableColumn({
                name: 'previous_token_expires_at', type: 'datetime', isNullable: true,
            }));
        }
        const tabla = await queryRunner.getTable('lead_ingest_sources');
        if (!tabla?.indices.some((indice) => indice.name === 'IDX_lead_ingest_sources_previous_token')) {
            await queryRunner.createIndex('lead_ingest_sources', new typeorm_1.TableIndex({
                name: 'IDX_lead_ingest_sources_previous_token', columnNames: ['previous_token_hash'],
            }));
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('lead_ingest_sources')))
            return;
        const tabla = await queryRunner.getTable('lead_ingest_sources');
        const indice = tabla?.indices.find((item) => item.name === 'IDX_lead_ingest_sources_previous_token');
        if (indice)
            await queryRunner.dropIndex('lead_ingest_sources', indice);
        for (const columna of ['previous_token_hash', 'previous_token_expires_at']) {
            if (await queryRunner.hasColumn('lead_ingest_sources', columna)) {
                await queryRunner.dropColumn('lead_ingest_sources', columna);
            }
        }
    }
}
exports.LlaveAnteriorConGracia1756300000111 = LlaveAnteriorConGracia1756300000111;
