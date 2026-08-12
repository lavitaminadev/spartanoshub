import { DocumentParserService } from "./document-parser.service";
import { ChunkerService } from "./chunker.service";
import { TextCleanerService } from "./text-cleaner.service";
import { EmbeddingsService } from "./embeddings.service";
import { RagService } from "./rag.service";
import type { DocumentProcessingJob } from "./document-types";
export declare class DocumentProcessorService {
    private readonly parser;
    private readonly chunker;
    private readonly textCleaner;
    private readonly embeddings;
    private readonly rag;
    constructor(parser: DocumentParserService, chunker: ChunkerService, textCleaner: TextCleanerService, embeddings: EmbeddingsService, rag: RagService);
    process(job: DocumentProcessingJob): Promise<{
        success: boolean;
        error?: string;
        chunks?: number;
    }>;
}
