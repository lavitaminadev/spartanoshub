import { EmbeddingsService } from "./embeddings.service";
import { KnowledgeStore } from "./knowledge.store";
export interface RagSearchResult {
    content: string;
    sourceName: string;
    score: number;
}
export declare class RagService {
    private readonly embeddings;
    private readonly store;
    private readonly logger;
    constructor(embeddings: EmbeddingsService, store: KnowledgeStore);
    storeChunk(tenantId: string, content: string, embedding: number[], metadata: {
        sourceName: string;
        chunkIndex: number;
        tokenCount: number;
    }): Promise<void>;
    semanticSearch(tenantId: string, query: string, limit?: number): Promise<RagSearchResult[]>;
    augmentPrompt(tenantId: string, userMessage: string, systemPrompt: string): Promise<string>;
    deleteSource(tenantId: string, sourceName: string): Promise<void>;
    stats(tenantId: string): Promise<{
        totalChunks: number;
        totalSources: number;
    }>;
}
