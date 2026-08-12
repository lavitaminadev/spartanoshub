"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationWelcomeMessage1724162000000 = void 0;
const typeorm_1 = require("typeorm");
class OrganizationWelcomeMessage1724162000000 {
    constructor() {
        this.name = 'OrganizationWelcomeMessage1724162000000';
    }
    async up(queryRunner) {
        if (!(await queryRunner.hasColumn('organizations', 'welcome_message'))) {
            await queryRunner.addColumn('organizations', new typeorm_1.TableColumn({
                name: 'welcome_message',
                type: 'varchar',
                length: '500',
                isNullable: true,
            }));
        }
        const table = await queryRunner.getTable('organizations');
        const logoUrl = table?.findColumnByName('logo_url');
        if (logoUrl && logoUrl.length !== '500') {
            await queryRunner.query('ALTER TABLE `organizations` MODIFY COLUMN `logo_url` varchar(500) NULL');
        }
    }
    async down(queryRunner) {
        if (await queryRunner.hasColumn('organizations', 'welcome_message')) {
            await queryRunner.dropColumn('organizations', 'welcome_message');
        }
    }
}
exports.OrganizationWelcomeMessage1724162000000 = OrganizationWelcomeMessage1724162000000;
