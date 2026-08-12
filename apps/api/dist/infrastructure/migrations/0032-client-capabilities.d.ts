import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class ClientCapabilities1710000000032 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
