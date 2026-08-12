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
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeChunk = void 0;
const typeorm_1 = require("typeorm");
const organization_entity_1 = require("../organizations/organization.entity");
let KnowledgeChunk = class KnowledgeChunk {
};
exports.KnowledgeChunk = KnowledgeChunk;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], KnowledgeChunk.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'tenant_id', type: 'uuid' }),
    __metadata("design:type", String)
], KnowledgeChunk.prototype, "tenantId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => organization_entity_1.Organization),
    (0, typeorm_1.JoinColumn)({ name: 'tenant_id' }),
    __metadata("design:type", organization_entity_1.Organization)
], KnowledgeChunk.prototype, "tenant", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], KnowledgeChunk.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json' }),
    __metadata("design:type", Array)
], KnowledgeChunk.prototype, "embedding", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'source_name', type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], KnowledgeChunk.prototype, "sourceName", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chunk_index', type: 'int' }),
    __metadata("design:type", Number)
], KnowledgeChunk.prototype, "chunkIndex", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'token_count', type: 'int' }),
    __metadata("design:type", Number)
], KnowledgeChunk.prototype, "tokenCount", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], KnowledgeChunk.prototype, "createdAt", void 0);
exports.KnowledgeChunk = KnowledgeChunk = __decorate([
    (0, typeorm_1.Entity)('knowledge_chunks')
], KnowledgeChunk);
//# sourceMappingURL=knowledge-chunk.entity.js.map