import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddClientLogo1724161000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
