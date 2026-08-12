"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationFeatures1724247600000 = void 0;
const typeorm_1 = require("typeorm");
class OrganizationFeatures1724247600000 {
    constructor() {
        this.name = 'OrganizationFeatures1724247600000';
    }
    async up(queryRunner) {
        if (await queryRunner.hasColumn('organizations', 'features'))
            return;
        await queryRunner.addColumn('organizations', new typeorm_1.TableColumn({
            name: 'features',
            type: 'json',
            isNullable: true,
        }));
    }
    async down(queryRunner) {
        if (!(await queryRunner.hasColumn('organizations', 'features')))
            return;
        await queryRunner.dropColumn('organizations', 'features');
    }
}
exports.OrganizationFeatures1724247600000 = OrganizationFeatures1724247600000;
