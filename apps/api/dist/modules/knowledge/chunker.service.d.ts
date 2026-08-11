import { TextCleanerService } from "./text-cleaner.service";
export interface ChunkResult {
    content: string;
    chunkIndex: number;
    tokenCount: number;
}
export declare class ChunkerService {
    private readonly textCleaner;
    constructor(textCleaner: TextCleanerService);
    chunkText(text: string, chunkSize?: number, chunkOverlap?: number): Promise<ChunkResult[]>;
    private manualChunk;
}
