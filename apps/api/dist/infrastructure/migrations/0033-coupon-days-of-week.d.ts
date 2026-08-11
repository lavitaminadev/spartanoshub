import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddCouponDaysOfWeek1710000000033 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
