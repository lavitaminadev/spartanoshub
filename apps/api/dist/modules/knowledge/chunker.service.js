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
exports.ChunkerService = void 0;
const common_1 = require("@nestjs/common");
const text_cleaner_service_1 = require("./text-cleaner.service");
const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;
let ChunkerService = class ChunkerService {
    constructor(textCleaner) {
        this.textCleaner = textCleaner;
    }
    async chunkText(text, chunkSize, chunkOverlap) {
        const cleaned = this.textCleaner.clean(text);
        if (!cleaned)
            return [];
        const size = chunkSize ?? DEFAULT_CHUNK_SIZE;
        const overlap = chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;
        return this.manualChunk(cleaned, size, overlap);
    }
    manualChunk(text, chunkSize, chunkOverlap) {
        const paragraphs = text.split(/\n\n+/).filter(Boolean);
        const chunks = [];
        let current = "";
        let index = 0;
        for (const para of paragraphs) {
            if ((current + "\n\n" + para).trim().length > chunkSize && current) {
                chunks.push({
                    content: current.trim(),
                    chunkIndex: index++,
                    tokenCount: this.textCleaner.estimateTokenCount(current),
                });
                const words = current.split(" ");
                const overlapWords = words.slice(Math.max(0, words.length - Math.floor(chunkOverlap / 5)));
                current = overlapWords.join(" ") + "\n\n" + para;
            }
            else {
                current += (current ? "\n\n" : "") + para;
            }
        }
        if (current.trim()) {
            chunks.push({
                content: current.trim(),
                chunkIndex: index,
                tokenCount: this.textCleaner.estimateTokenCount(current),
            });
        }
        return chunks;
    }
};
exports.ChunkerService = ChunkerService;
exports.ChunkerService = ChunkerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [text_cleaner_service_1.TextCleanerService])
], ChunkerService);
