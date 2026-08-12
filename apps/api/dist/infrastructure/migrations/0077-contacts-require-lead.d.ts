import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class ContactsRequireLead1726200000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
    private getLeadIdSqlDefinition;
    private ensureLeadColumn;
    private linkExistingContacts;
    private setLeadColumnNullability;
    private renderSqlType;
    private assertSafeSqlType;
    private optionalString;
    private findLeadForeignKey;
    private leadForeignKey;
}
