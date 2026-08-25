"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeadTrafficLight1756100000108 = void 0;
const typeorm_1 = require("typeorm");
class LeadTrafficLight1756100000108 {
    constructor() {
        this.name = 'LeadTrafficLight1756100000108';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('leads', 'traffic_light'))) {
            await queryRunner.addColumn('leads', new typeorm_1.TableColumn({
                name: 'traffic_light', type: 'varchar', length: '10', isNullable: true,
            }));
        }
        await queryRunner.query("UPDATE leads SET fit_status = 'unqualified' WHERE fit_status = 'discarded'");
    }
    async down(queryRunner) {
        await queryRunner.query("UPDATE leads SET fit_status = 'discarded' WHERE fit_status = 'unqualified'");
        if (await queryRunner.hasColumn('leads', 'traffic_light')) {
            await queryRunner.dropColumn('leads', 'traffic_light');
        }
    }
}
exports.LeadTrafficLight1756100000108 = LeadTrafficLight1756100000108;
