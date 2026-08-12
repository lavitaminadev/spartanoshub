import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class RestrictClientDeleteWithBilling1721766000000 implements MigrationInterface {
    name: string;
    private replaceClientFk;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
