import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class ScopeInvoiceQuoteNumberPerOrg1721765000000 implements MigrationInterface {
    name: string;
    private findUniqueIndexOnColumn;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
