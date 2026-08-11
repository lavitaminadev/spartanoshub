import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class CommercialPlanning1710000000025 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
