import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddCoupons1710000000031 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
