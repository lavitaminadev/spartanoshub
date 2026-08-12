"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentProcessorService = void 0;
const common_1 = require("@nestjs/common");
const document_parser_service_1 = require("./document-parser.service");
const chunker_service_1 = require("./chunker.service");
const text_cleaner_service_1 = require("./text-cleaner.service");
const embeddings_service_1 = require("./embeddings.service");
const rag_service_1 = require("./rag.service");
let DocumentProcessorService = class DocumentProcessorService {
    constructor(parser, chunker, textCleaner, embeddings, rag) {
        this.parser = parser;
        this.chunker = chunker;
        this.textCleaner = textCleaner;
        this.embeddings = embeddings;
        this.rag = rag;
    }
    async process(job) {
        let buffer;
        if (job.bufferBase64) {
            buffer = Buffer.from(job.bufferBase64, "base64");
        }
        else if (job.filePath) {
            const fs = await Promise.resolve().then(() => __importStar(require("fs/promises")));
            buffer = await fs.readFile(job.filePath);
        }
        else {
            return { success: false, error: "No file data provided" };
        }
        const parseResult = await this.parser.parse(buffer, job.filename, job.mimeType);
        if (!parseResult.success)
            return { success: false, error: parseResult.error || "Parse failed" };
        if (!parseResult.document?.text || parseResult.document.text.length < 10)
            return { success: false, error: "Extracted text too short" };
        const rawText = this.textCleaner.clean(parseResult.document.text);
        const chunks = await this.chunker.chunkText(rawText);
        if (chunks.length === 0)
            return { success: false, error: "No chunks generated" };
        const chunkTexts = chunks.map((c) => c.content);
        let embeddings;
        try {
            embeddings = await this.embeddings.createBatch(chunkTexts);
        }
        catch (error) {
            return {
                success: false,
                error: `Embedding generation failed: ${error instanceof Error ? error.message : "Unknown"}`,
            };
        }
        for (let i = 0; i < chunks.length; i++) {
            await this.rag.storeChunk(job.tenantId, chunks[i].content, embeddings[i], {
                sourceName: job.filename,
                chunkIndex: chunks[i].chunkIndex,
                tokenCount: chunks[i].tokenCount,
            });
        }
        return { success: true, chunks: chunks.length };
    }
};
exports.DocumentProcessorService = DocumentProcessorService;
exports.DocumentProcessorService = DocumentProcessorService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [document_parser_service_1.DocumentParserService,
        chunker_service_1.ChunkerService,
        text_cleaner_service_1.TextCleanerService,
        embeddings_service_1.EmbeddingsService,
        rag_service_1.RagService])
], DocumentProcessorService);
