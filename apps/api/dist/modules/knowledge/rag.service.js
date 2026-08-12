"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RagService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RagService = void 0;
const common_1 = require("@nestjs/common");
const embeddings_service_1 = require("./embeddings.service");
const knowledge_store_1 = require("./knowledge.store");
const node_crypto_1 = require("node:crypto");
let RagService = RagService_1 = class RagService {
    constructor(embeddings, store) {
        this.embeddings = embeddings;
        this.store = store;
        this.logger = new common_1.Logger(RagService_1.name);
    }
    async storeChunk(tenantId, content, embedding, metadata) {
        await this.store.add({
            id: (0, node_crypto_1.randomUUID)(),
            tenantId,
            content,
            embedding,
            sourceName: metadata.sourceName,
            chunkIndex: metadata.chunkIndex,
            tokenCount: metadata.tokenCount,
            createdAt: Date.now(),
        });
    }
    async semanticSearch(tenantId, query, limit = 5) {
        try {
            const queryEmbedding = await this.embeddings.create(query);
            const results = await this.store.search(tenantId, queryEmbedding, limit);
            return results.map((r) => ({ content: r.content, sourceName: r.sourceName, score: r.score }));
        }
        catch (error) {
            this.logger.warn(`Semantic search unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
            return [];
        }
    }
    async augmentPrompt(tenantId, userMessage, systemPrompt) {
        const relevantDocs = await this.semanticSearch(tenantId, userMessage, 5);
        if (relevantDocs.length === 0)
            return systemPrompt;
        const contextBlock = relevantDocs
            .map((doc) => `[${doc.sourceName}] (relevancia: ${(doc.score * 100).toFixed(0)}%)\n${doc.content}`)
            .join("\n\n---\n\n");
        return `${systemPrompt}\n\n## Contexto recuperado\n${contextBlock}\n\nInstrucciones:
- Usa el contexto de arriba para responder si es relevante.
- Si el contexto no contiene la respuesta, dilo claramente.
- No inventes información que no esté en el contexto.
- Cita el nombre del documento fuente cuando uses información del contexto.`;
    }
    async deleteSource(tenantId, sourceName) {
        await this.store.deleteBySource(tenantId, sourceName);
    }
    async stats(tenantId) {
        return this.store.stats(tenantId);
    }
};
exports.RagService = RagService;
exports.RagService = RagService = RagService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [embeddings_service_1.EmbeddingsService,
        knowledge_store_1.KnowledgeStore])
], RagService);
//# sourceMappingURL=rag.service.js.map