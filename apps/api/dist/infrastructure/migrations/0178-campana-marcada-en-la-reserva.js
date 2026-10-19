"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampanaMarcadaEnLaReserva1790000000178 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class CampanaMarcadaEnLaReserva1790000000178 {
    constructor() {
        this.name = 'CampanaMarcadaEnLaReserva1790000000178';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('email_campaigns')))
            return;
        if (!(await (0, catalogo_1.hayColumna)(queryRunner, 'email_campaigns', 'utm_campaign'))) {
            await queryRunner.query('ALTER TABLE email_campaigns ADD COLUMN utm_campaign VARCHAR(180) NULL');
        }
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('email_campaigns')))
            return;
        if (await (0, catalogo_1.hayColumna)(queryRunner, 'email_campaigns', 'utm_campaign')) {
            await queryRunner.query('ALTER TABLE email_campaigns DROP COLUMN utm_campaign');
        }
    }
}
exports.CampanaMarcadaEnLaReserva1790000000178 = CampanaMarcadaEnLaReserva1790000000178;
