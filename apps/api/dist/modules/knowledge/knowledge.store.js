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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeStore = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const knowledge_chunk_entity_1 = require("./knowledge-chunk.entity");
function toStoredChunk(row) {
    return {
        id: row.id,
        tenantId: row.tenantId,
        content: row.content,
        embedding: row.embedding,
        sourceName: row.sourceName,
        chunkIndex: row.chunkIndex,
        tokenCount: row.tokenCount,
        createdAt: row.createdAt.getTime(),
    };
}
let KnowledgeStore = class KnowledgeStore {
    constructor(repo) {
        this.repo = repo;
    }
    async add(chunk) {
        await this.repo.save(this.repo.create({
            id: chunk.id,
            tenantId: chunk.tenantId,
            content: chunk.content,
            embedding: chunk.embedding,
            sourceName: chunk.sourceName,
            chunkIndex: chunk.chunkIndex,
            tokenCount: chunk.tokenCount,
        }));
    }
    async get(id) {
        const row = await this.repo.findOne({ where: { id } });
        return row ? toStoredChunk(row) : undefined;
    }
    async getByTenant(tenantId) {
        const rows = await this.repo.find({ where: { tenantId }, order: { createdAt: "ASC" } });
        return rows.map(toStoredChunk);
    }
    async search(tenantId, queryEmbedding, limit) {
        const tenantChunks = await this.getByTenant(tenantId);
        const scored = tenantChunks.map((chunk) => ({
            ...chunk,
            score: this.cosineSimilarity(queryEmbedding, chunk.embedding),
        }));
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit);
    }
    async deleteBySource(tenantId, sourceName) {
        await this.repo.delete({ tenantId, sourceName });
    }
    async deleteAll(tenantId) {
        await this.repo.delete({ tenantId });
    }
    cosineSimilarity(a, b) {
        let dot = 0, magA = 0, magB = 0;
        for (let i = 0; i < a.length; i++) {
            dot += a[i] * b[i];
            magA += a[i] * a[i];
            magB += b[i] * b[i];
        }
        const denom = Math.sqrt(magA) * Math.sqrt(magB);
        return denom === 0 ? 0 : dot / denom;
    }
    async stats(tenantId) {
        const chunks = await this.getByTenant(tenantId);
        return { totalChunks: chunks.length, totalSources: new Set(chunks.map((chunk) => chunk.sourceName)).size };
    }
};
exports.KnowledgeStore = KnowledgeStore;
exports.KnowledgeStore = KnowledgeStore = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(knowledge_chunk_entity_1.KnowledgeChunk)),
    __metadata("design:paramtypes", [typeorm_2.Repository])
], KnowledgeStore);
