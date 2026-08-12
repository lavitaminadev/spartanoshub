import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class GoogleConversionOutbox1724247500000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
