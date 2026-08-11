import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class IntegrationMetrics1710000000015 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
