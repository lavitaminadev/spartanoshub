import { MigrationInterface, QueryRunner } from 'typeorm';
export declare class AddTeamNotifications1710000000030 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
