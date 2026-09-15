"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrigenDetectado1789800000000 = void 0;
const typeorm_1 = require("typeorm");
class OrigenDetectado1789800000000 {
    constructor() {
        this.name = 'OrigenDetectado1789800000000';
    }
    async up(queryRunner) {
        for (const tabla of ['reservations', 'reservation_form_events', 'reservation_group_requests']) {
            if (await queryRunner.hasTable(tabla) && !(await queryRunner.hasColumn(tabla, 'origin_detected'))) {
                await queryRunner.addColumn(tabla, new typeorm_1.TableColumn({ name: 'origin_detected', type: 'tinyint', width: 1, default: 0 }));
            }
        }
        for (const tabla of ['reservations', 'reservation_form_events', 'reservation_group_requests']) {
            if (await queryRunner.hasTable(tabla)) {
                await queryRunner.query(`UPDATE ${tabla} SET origin_detected = 1, utm_content = NULL WHERE utm_content = 'deteccion-automatica'`);
            }
        }
    }
    async down(queryRunner) {
        for (const tabla of ['reservation_group_requests', 'reservation_form_events', 'reservations']) {
            if (await queryRunner.hasTable(tabla) && await queryRunner.hasColumn(tabla, 'origin_detected')) {
                await queryRunner.query(`UPDATE ${tabla} SET utm_content = 'deteccion-automatica' WHERE origin_detected = 1 AND utm_content IS NULL`);
                await queryRunner.dropColumn(tabla, 'origin_detected');
            }
        }
    }
}
exports.OrigenDetectado1789800000000 = OrigenDetectado1789800000000;
