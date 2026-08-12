import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class DefensiveFksChargeNotesCycles1721766500000 implements MigrationInterface {
    name: string;
    private readonly candidates;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
