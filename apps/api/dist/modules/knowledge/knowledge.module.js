"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const typeorm_1 = require("@nestjs/typeorm");
const knowledge_controller_1 = require("./knowledge.controller");
const rag_service_1 = require("./rag.service");
const knowledge_store_1 = require("./knowledge.store");
const knowledge_chunk_entity_1 = require("./knowledge-chunk.entity");
const chunker_service_1 = require("./chunker.service");
const text_cleaner_service_1 = require("./text-cleaner.service");
const document_parser_service_1 = require("./document-parser.service");
const document_processor_service_1 = require("./document-processor.service");
const embeddings_service_1 = require("./embeddings.service");
let KnowledgeModule = class KnowledgeModule {
};
exports.KnowledgeModule = KnowledgeModule;
exports.KnowledgeModule = KnowledgeModule = __decorate([
    (0, common_1.Module)({
        imports: [axios_1.HttpModule, typeorm_1.TypeOrmModule.forFeature([knowledge_chunk_entity_1.KnowledgeChunk])],
        controllers: [knowledge_controller_1.KnowledgeController],
        providers: [
            rag_service_1.RagService,
            knowledge_store_1.KnowledgeStore,
            chunker_service_1.ChunkerService,
            text_cleaner_service_1.TextCleanerService,
            document_parser_service_1.DocumentParserService,
            document_processor_service_1.DocumentProcessorService,
            embeddings_service_1.EmbeddingsService,
        ],
        exports: [
            rag_service_1.RagService,
            knowledge_store_1.KnowledgeStore,
            document_processor_service_1.DocumentProcessorService,
            document_parser_service_1.DocumentParserService,
            embeddings_service_1.EmbeddingsService,
        ],
    })
], KnowledgeModule);
//# sourceMappingURL=knowledge.module.js.map