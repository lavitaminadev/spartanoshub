import { Organization } from '../organizations/organization.entity';
export declare class KnowledgeChunk {
    id: string;
    tenantId: string;
    tenant: Organization;
    content: string;
    embedding: number[];
    sourceName: string;
    chunkIndex: number;
    tokenCount: number;
    createdAt: Date;
}
