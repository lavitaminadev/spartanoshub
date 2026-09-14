"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AceptacionEnEncuestas1789600000000 = void 0;
const typeorm_1 = require("typeorm");
class AceptacionEnEncuestas1789600000000 {
    constructor() {
        this.name = 'AceptacionEnEncuestas1789600000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('survey_responses', 'privacy_consent_at'))) {
            await queryRunner.addColumn('survey_responses', new typeorm_1.TableColumn({ name: 'privacy_consent_at', type: 'timestamp', isNullable: true }));
        }
        if (!(await queryRunner.hasColumn('survey_responses', 'privacy_consent_text'))) {
            await queryRunner.addColumn('survey_responses', new typeorm_1.TableColumn({ name: 'privacy_consent_text', type: 'text', isNullable: true }));
        }
    }
    async down(queryRunner) {
        for (const nombre of ['privacy_consent_text', 'privacy_consent_at']) {
            if (await queryRunner.hasColumn('survey_responses', nombre))
                await queryRunner.dropColumn('survey_responses', nombre);
        }
    }
}
exports.AceptacionEnEncuestas1789600000000 = AceptacionEnEncuestas1789600000000;
