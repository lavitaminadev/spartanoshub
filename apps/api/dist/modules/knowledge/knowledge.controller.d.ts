import { KnowledgeStore } from './knowledge.store';
import { RagService } from './rag.service';
import type { AuthenticatedRequest } from '@shared/types/request';
export declare class KnowledgeController {
    private readonly store;
    private readonly rag;
    constructor(store: KnowledgeStore, rag: RagService);
    list(req: AuthenticatedRequest): Promise<import("./knowledge.store").StoredChunk[]>;
    stats(req: AuthenticatedRequest): Promise<{
        totalChunks: number;
        totalSources: number;
    }>;
    search(query: string, req: AuthenticatedRequest): Promise<import("./rag.service").RagSearchResult[]>;
}
