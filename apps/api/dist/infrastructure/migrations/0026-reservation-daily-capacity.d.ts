import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class ReservationDailyCapacity1710000000026 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
