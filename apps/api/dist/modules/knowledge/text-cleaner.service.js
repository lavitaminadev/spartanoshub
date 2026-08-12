"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextCleanerService = void 0;
const common_1 = require("@nestjs/common");
let TextCleanerService = class TextCleanerService {
    clean(text) {
        return text
            .replace(/\0/g, "")
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
            .replace(/\t/g, " ")
            .replace(/[ \t]{4,}/g, "  ")
            .replace(/\n{4,}/g, "\n\n\n")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/&#x2F;/g, "/")
            .replace(/\u00A0/g, " ")
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0)
            .join("\n")
            .trim();
    }
    estimateTokenCount(text) {
        return Math.ceil(text.length / 4);
    }
};
exports.TextCleanerService = TextCleanerService;
exports.TextCleanerService = TextCleanerService = __decorate([
    (0, common_1.Injectable)()
], TextCleanerService);
