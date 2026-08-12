"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddTeamNotifications1710000000030 = void 0;
const typeorm_1 = require("typeorm");
class AddTeamNotifications1710000000030 {
    constructor() {
        this.name = 'AddTeamNotifications1710000000030';
    }
    async up(queryRunner) {
        if (!await queryRunner.hasColumn('reservation_forms', 'team_notifications')) {
            await queryRunner.addColumn('reservation_forms', new typeorm_1.TableColumn({ name: 'team_notifications', type: 'json', isNullable: true }));
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('reservation_forms', 'team_notifications')) {
            await queryRunner.dropColumn('reservation_forms', 'team_notifications');
        }
    }
}
exports.AddTeamNotifications1710000000030 = AddTeamNotifications1710000000030;
