import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class LeadDomain1725500000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
