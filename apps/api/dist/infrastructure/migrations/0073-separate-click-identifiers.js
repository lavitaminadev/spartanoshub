"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeparateClickIdentifiers1725800000000 = void 0;
const typeorm_1 = require("typeorm");
class SeparateClickIdentifiers1725800000000 {
    constructor() {
        this.name = 'SeparateClickIdentifiers1725800000000';
    }
    async up(queryRunner) {
        for (const name of SeparateClickIdentifiers1725800000000.COLUMNS) {
            if (await queryRunner.hasColumn('reservations', name))
                continue;
            await queryRunner.addColumn('reservations', new typeorm_1.TableColumn({
                name, type: 'varchar', length: '255', isNullable: true,
            }));
        }
        await queryRunner.query('UPDATE `reservations` SET `gclid` = `click_id` WHERE `click_id` IS NOT NULL AND `gclid` IS NULL');
    }
    async down(queryRunner) {
        for (const name of [...SeparateClickIdentifiers1725800000000.COLUMNS].reverse()) {
            if (await queryRunner.hasColumn('reservations', name))
                await queryRunner.dropColumn('reservations', name);
        }
    }
}
exports.SeparateClickIdentifiers1725800000000 = SeparateClickIdentifiers1725800000000;
SeparateClickIdentifiers1725800000000.COLUMNS = ['gclid', 'gbraid', 'wbraid', 'fbclid'];
