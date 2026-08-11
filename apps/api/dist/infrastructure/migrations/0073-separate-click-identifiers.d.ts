import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class SeparateClickIdentifiers1725800000000 implements MigrationInterface {
    name: string;
    private static readonly COLUMNS;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
