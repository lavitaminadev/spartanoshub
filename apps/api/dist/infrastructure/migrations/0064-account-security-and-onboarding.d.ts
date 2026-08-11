import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AccountSecurityAndOnboarding1724165000000 implements MigrationInterface {
    name: string;
    private readonly columns;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
