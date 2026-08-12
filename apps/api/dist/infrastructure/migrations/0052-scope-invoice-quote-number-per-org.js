"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeInvoiceQuoteNumberPerOrg1721765000000 = void 0;
class ScopeInvoiceQuoteNumberPerOrg1721765000000 {
    constructor() {
        this.name = 'ScopeInvoiceQuoteNumberPerOrg1721765000000';
    }
    async findUniqueIndexOnColumn(queryRunner, table, column) {
        const rows = await queryRunner.query(`SELECT DISTINCT INDEX_NAME FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND NON_UNIQUE = 0 AND INDEX_NAME != 'PRIMARY'`, [table, column]);
        return rows[0]?.INDEX_NAME;
    }
    async up(queryRunner) {
        const invoiceIndex = await this.findUniqueIndexOnColumn(queryRunner, 'invoices', 'number');
        if (invoiceIndex)
            await queryRunner.query(`ALTER TABLE invoices DROP INDEX \`${invoiceIndex}\``);
        await queryRunner.query('ALTER TABLE invoices ADD UNIQUE INDEX UQ_invoices_org_number (organization_id, number)');
        const quoteIndex = await this.findUniqueIndexOnColumn(queryRunner, 'quotes', 'number');
        if (quoteIndex)
            await queryRunner.query(`ALTER TABLE quotes DROP INDEX \`${quoteIndex}\``);
        await queryRunner.query('ALTER TABLE quotes ADD UNIQUE INDEX UQ_quotes_org_number (organization_id, number)');
    }
    async down(queryRunner) {
        await queryRunner.query('ALTER TABLE invoices DROP INDEX UQ_invoices_org_number');
        await queryRunner.query('ALTER TABLE invoices ADD UNIQUE INDEX number (number)');
        await queryRunner.query('ALTER TABLE quotes DROP INDEX UQ_quotes_org_number');
        await queryRunner.query('ALTER TABLE quotes ADD UNIQUE INDEX number (number)');
    }
}
exports.ScopeInvoiceQuoteNumberPerOrg1721765000000 = ScopeInvoiceQuoteNumberPerOrg1721765000000;
//# sourceMappingURL=0052-scope-invoice-quote-number-per-org.js.map