import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class OperationalSchema1710000000019 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(): Promise<void>;
    private ensureUserClientScope;
    private ensureNotifications;
    private ensureExistingOperationalColumns;
    private createCrmTables;
    private createCatalogAndContractTables;
    private createAudiovisualTables;
    private createIfMissing;
    private ensureColumn;
    private ensureIndex;
    private ensureForeignKey;
    private id;
    private orgId;
    private timestamps;
    private foreignKey;
}
