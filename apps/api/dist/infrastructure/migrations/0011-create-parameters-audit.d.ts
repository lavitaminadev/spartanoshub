import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class CreateParametersAudit1710000000011 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
