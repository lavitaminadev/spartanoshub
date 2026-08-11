import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class CriticalIndexes1710000000034 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
