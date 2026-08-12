import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class OrganizationFeatures1724247600000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
