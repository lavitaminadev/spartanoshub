"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncuestasAtencionYVisitas1789700000000 = void 0;
const typeorm_1 = require("typeorm");
class EncuestasAtencionYVisitas1789700000000 {
    constructor() {
        this.name = 'EncuestasAtencionYVisitas1789700000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('survey_responses', 'attended_at'))) {
            await queryRunner.addColumn('survey_responses', new typeorm_1.TableColumn({ name: 'attended_at', type: 'timestamp', isNullable: true }));
        }
        if (!(await queryRunner.hasColumn('survey_responses', 'attended_by'))) {
            await queryRunner.addColumn('survey_responses', new typeorm_1.TableColumn({ name: 'attended_by', type: 'varchar', length: '36', isNullable: true }));
        }
        if (!(await queryRunner.hasTable('survey_visits'))) {
            await queryRunner.createTable(new typeorm_1.Table({
                name: 'survey_visits',
                columns: [
                    { name: 'id', type: 'varchar', length: '36', isPrimary: true, isGenerated: true, generationStrategy: 'uuid' },
                    { name: 'organization_id', type: 'varchar', length: '36' },
                    { name: 'survey_id', type: 'varchar', length: '36' },
                    { name: 'origen', type: 'varchar', length: '60', isNullable: true },
                    { name: 'session_id', type: 'varchar', length: '80' },
                    { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
                ],
            }));
            await queryRunner.createIndex('survey_visits', new typeorm_1.TableIndex({ name: 'UQ_survey_visit_session', columnNames: ['survey_id', 'session_id'], isUnique: true }));
            await queryRunner.createIndex('survey_visits', new typeorm_1.TableIndex({ name: 'IDX_survey_visits_survey_fecha', columnNames: ['survey_id', 'created_at'] }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('survey_visits'))
            await queryRunner.dropTable('survey_visits');
        for (const nombre of ['attended_by', 'attended_at']) {
            if (await queryRunner.hasColumn('survey_responses', nombre))
                await queryRunner.dropColumn('survey_responses', nombre);
        }
    }
}
exports.EncuestasAtencionYVisitas1789700000000 = EncuestasAtencionYVisitas1789700000000;
