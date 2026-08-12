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
exports.EmbeddingsService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const rxjs_1 = require("rxjs");
let EmbeddingsService = class EmbeddingsService {
    constructor(http) {
        this.http = http;
    }
    async create(text) {
        const results = await this.createBatch([text]);
        return results[0];
    }
    async createBatch(texts) {
        const apiKey = process.env.OPENAI_API_KEY;
        const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
        if (apiKey) {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.http.post("https://api.openai.com/v1/embeddings", { model, input: texts }, { headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" } }));
            return data.data.map((item) => item.embedding);
        }
        throw new common_1.ServiceUnavailableException("La búsqueda semántica no tiene un proveedor de embeddings configurado");
    }
};
exports.EmbeddingsService = EmbeddingsService;
exports.EmbeddingsService = EmbeddingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService])
], EmbeddingsService);
