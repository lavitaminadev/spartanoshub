"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationFormEventMetadata1724248700000 = void 0;
const typeorm_1 = require("typeorm");
class ReservationFormEventMetadata1724248700000 {
    constructor() {
        this.name = 'ReservationFormEventMetadata1724248700000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasColumn('reservation_form_events', 'metadata'))
            return;
        await queryRunner.addColumn('reservation_form_events', new typeorm_1.TableColumn({
            name: 'metadata',
            type: 'json',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasColumn('reservation_form_events', 'metadata')))
            return;
        await queryRunner.dropColumn('reservation_form_events', 'metadata');
    }
}
exports.ReservationFormEventMetadata1724248700000 = ReservationFormEventMetadata1724248700000;
//# sourceMappingURL=0062-reservation-form-event-metadata.js.map