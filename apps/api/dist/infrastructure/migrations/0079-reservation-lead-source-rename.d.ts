import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class ReservationLeadSourceRename1726900000000 implements MigrationInterface {
    name: string;
    private static readonly PREVIOUS;
    private static readonly CURRENT;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
    private static rewrite;
}
