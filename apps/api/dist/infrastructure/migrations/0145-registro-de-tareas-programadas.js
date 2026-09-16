"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RegistroDeTareasProgramadas1790000000145 = void 0;
const typeorm_1 = require("typeorm");
class RegistroDeTareasProgramadas1790000000145 {
    constructor() {
        this.name = 'RegistroDeTareasProgramadas1790000000145';
    }
    async up(queryRunner) {
        if (await queryRunner.hasTable('cron_runs'))
            return;
        await queryRunner.createTable(new typeorm_1.Table({
            name: 'cron_runs',
            columns: [
                { name: 'task', type: 'varchar', length: '80', isPrimary: true },
                { name: 'last_run_at', type: 'timestamp', isNullable: false },
                { name: 'ok', type: 'boolean', default: true },
                { name: 'detail', type: 'varchar', length: '500', isNullable: true },
            ],
        }));
    }
    async down(queryRunner) {
        if (await queryRunner.hasTable('cron_runs'))
            await queryRunner.dropTable('cron_runs');
    }
}
exports.RegistroDeTareasProgramadas1790000000145 = RegistroDeTareasProgramadas1790000000145;
