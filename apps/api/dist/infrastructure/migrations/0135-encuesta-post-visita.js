"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncuestaPostVisita1758700000000 = void 0;
class EncuestaPostVisita1758700000000 {
    constructor() {
        this.name = 'EncuestaPostVisita1758700000000';
    }
    async existe(queryRunner, tabla, columna) {
        const rows = await queryRunner.query('SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?', [tabla, columna]);
        return Number(rows?.[0]?.n ?? 0) > 0;
    }
    async indiceExiste(queryRunner, tabla, indice) {
        const rows = await queryRunner.query('SELECT COUNT(*) AS n FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?', [tabla, indice]);
        return Number(rows?.[0]?.n ?? 0) > 0;
    }
    async up(queryRunner) {
        for (const { tabla, columna, tipo } of EncuestaPostVisita1758700000000.COLUMNAS) {
            if (await this.existe(queryRunner, tabla, columna))
                continue;
            await queryRunner.query(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${tipo} NULL`);
        }
        if (!(await this.indiceExiste(queryRunner, 'reservations', 'IDX_reservations_post_visit'))) {
            await queryRunner.query('CREATE INDEX IDX_reservations_post_visit ON reservations (status, post_visit_survey_sent_at, ends_at)');
        }
        if (!(await this.indiceExiste(queryRunner, 'survey_responses', 'IDX_survey_response_reservation'))) {
            await queryRunner.query('CREATE INDEX IDX_survey_response_reservation ON survey_responses (reservation_id)');
        }
    }
    async down(queryRunner) {
        if (await this.indiceExiste(queryRunner, 'survey_responses', 'IDX_survey_response_reservation')) {
            await queryRunner.query('DROP INDEX IDX_survey_response_reservation ON survey_responses');
        }
        if (await this.indiceExiste(queryRunner, 'reservations', 'IDX_reservations_post_visit')) {
            await queryRunner.query('DROP INDEX IDX_reservations_post_visit ON reservations');
        }
        for (const { tabla, columna } of EncuestaPostVisita1758700000000.COLUMNAS) {
            if (!(await this.existe(queryRunner, tabla, columna)))
                continue;
            await queryRunner.query(`ALTER TABLE ${tabla} DROP COLUMN ${columna}`);
        }
    }
}
exports.EncuestaPostVisita1758700000000 = EncuestaPostVisita1758700000000;
EncuestaPostVisita1758700000000.COLUMNAS = [
    { tabla: 'survey_responses', columna: 'reservation_id', tipo: 'varchar(36)' },
    { tabla: 'survey_responses', columna: 'respondent_name', tipo: 'varchar(180)' },
    { tabla: 'survey_responses', columna: 'respondent_email', tipo: 'varchar(190)' },
    { tabla: 'survey_responses', columna: 'rating', tipo: 'tinyint' },
    { tabla: 'survey_responses', columna: 'team_message', tipo: 'text' },
    { tabla: 'survey_responses', columna: 'completed_at', tipo: 'timestamp' },
    { tabla: 'survey_responses', columna: 'edit_token_hash', tipo: 'char(64)' },
    { tabla: 'reservations', columna: 'post_visit_survey_sent_at', tipo: 'timestamp' },
];
