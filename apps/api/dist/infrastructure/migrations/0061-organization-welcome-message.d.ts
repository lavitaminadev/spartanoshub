import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class OrganizationWelcomeMessage1724162000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
