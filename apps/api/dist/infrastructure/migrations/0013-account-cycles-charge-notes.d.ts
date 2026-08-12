import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AccountCyclesChargeNotes1710000000013 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
