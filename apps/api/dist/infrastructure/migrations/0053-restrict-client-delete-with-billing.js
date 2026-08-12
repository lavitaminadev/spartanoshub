"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RestrictClientDeleteWithBilling1721766000000 = void 0;
const typeorm_1 = require("typeorm");
class RestrictClientDeleteWithBilling1721766000000 {
    constructor() {
        this.name = 'RestrictClientDeleteWithBilling1721766000000';
    }
    async replaceClientFk(queryRunner, table, onDelete) {
        const tableSchema = await queryRunner.getTable(table);
        const foreignKey = tableSchema?.foreignKeys.find((key) => key.columnNames.includes('client_id') && key.referencedTableName === 'clients');
        if (foreignKey)
            await queryRunner.dropForeignKey(table, foreignKey);
        await queryRunner.createForeignKey(table, new typeorm_1.TableForeignKey({
            columnNames: ['client_id'],
            referencedTableName: 'clients',
            referencedColumnNames: ['id'],
            onDelete,
        }));
    }
    async up(queryRunner) {
        await this.replaceClientFk(queryRunner, 'invoices', 'RESTRICT');
        await this.replaceClientFk(queryRunner, 'monthly_reports', 'RESTRICT');
    }
    async down(queryRunner) {
        await this.replaceClientFk(queryRunner, 'invoices', 'CASCADE');
        await this.replaceClientFk(queryRunner, 'monthly_reports', 'CASCADE');
    }
}
exports.RestrictClientDeleteWithBilling1721766000000 = RestrictClientDeleteWithBilling1721766000000;
