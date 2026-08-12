import { QueryRunner } from 'typeorm';
export type IndexSpec = {
    table: string;
    name: string;
    columns: string[];
    definition?: string;
};
export declare function ensureIndexes(queryRunner: QueryRunner, specs: IndexSpec[]): Promise<void>;
export declare function dropIndexes(queryRunner: QueryRunner, specs: IndexSpec[]): Promise<void>;
