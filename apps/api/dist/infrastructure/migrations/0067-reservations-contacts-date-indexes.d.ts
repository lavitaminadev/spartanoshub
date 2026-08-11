import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class ReservationsContactsDateIndexes1724250000000 implements MigrationInterface {
    name: string;
    private createIndexIfMissing;
    private dropIndexIfExists;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
