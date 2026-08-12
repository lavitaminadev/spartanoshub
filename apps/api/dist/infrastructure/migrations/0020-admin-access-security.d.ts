import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AdminAccessSecurity1710000000020 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
    private ensureColumn;
}
