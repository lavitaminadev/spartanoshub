"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrigenDeLaReservaConsultable1790000000175 = void 0;
const catalogo_1 = require("./helpers/catalogo");
class OrigenDeLaReservaConsultable1790000000175 {
    constructor() {
        this.name = 'OrigenDeLaReservaConsultable1790000000175';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        if (await (0, catalogo_1.hayIndice)(queryRunner, 'reservations', 'IDX_reservations_org_client_campana'))
            return;
        await queryRunner.query('CREATE INDEX IDX_reservations_org_client_campana ON reservations (organization_id, client_id, utm_campaign, starts_at)');
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasTable('reservations')))
            return;
        if (!(await (0, catalogo_1.hayIndice)(queryRunner, 'reservations', 'IDX_reservations_org_client_campana')))
            return;
        await queryRunner.query('DROP INDEX IDX_reservations_org_client_campana ON reservations');
    }
}
exports.OrigenDeLaReservaConsultable1790000000175 = OrigenDeLaReservaConsultable1790000000175;
