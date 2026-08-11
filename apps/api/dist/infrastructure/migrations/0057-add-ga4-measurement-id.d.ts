import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddGa4MeasurementId1724247400000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
