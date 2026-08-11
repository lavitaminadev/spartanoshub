import { Repository } from "typeorm";
import { KnowledgeChunk } from "./knowledge-chunk.entity";
export interface StoredChunk {
    id: string;
    tenantId: string;
    content: string;
    embedding: number[];
    sourceName: string;
    chunkIndex: number;
    tokenCount: number;
    createdAt: number;
}
export declare class KnowledgeStore {
    private readonly repo;
    constructor(repo: Repository<KnowledgeChunk>);
    add(chunk: Omit<StoredChunk, "createdAt"> & {
        createdAt?: number;
    }): Promise<void>;
    get(id: string): Promise<StoredChunk | undefined>;
    getByTenant(tenantId: string): Promise<StoredChunk[]>;
    search(tenantId: string, queryEmbedding: number[], limit: number): Promise<Array<StoredChunk & {
        score: number;
    }>>;
    deleteBySource(tenantId: string, sourceName: string): Promise<void>;
    deleteAll(tenantId: string): Promise<void>;
    private cosineSimilarity;
    stats(tenantId: string): Promise<{
        totalChunks: number;
        totalSources: number;
    }>;
}
