"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentParserService = void 0;
const common_1 = require("@nestjs/common");
const document_types_1 = require("./document-types");
const text_parser_1 = require("./parsers/text.parser");
const csv_parser_1 = require("./parsers/csv.parser");
const html_parser_1 = require("./parsers/html.parser");
function getExtension(filename) {
    return filename.substring(filename.lastIndexOf(".")).toLowerCase();
}
let DocumentParserService = class DocumentParserService {
    validateFile(buffer, filename, mimeType) {
        if (!buffer || buffer.length === 0)
            return "File is empty";
        if (buffer.length > document_types_1.MAX_FILE_SIZE)
            return `File exceeds maximum size of ${document_types_1.MAX_FILE_SIZE / 1024 / 1024}MB`;
        const ext = getExtension(filename);
        if (!document_types_1.ALLOWED_EXTENSIONS.includes(ext))
            return `File type "${ext}" is not allowed. Allowed: ${document_types_1.ALLOWED_EXTENSIONS.join(", ")}`;
        if (mimeType && !document_types_1.ALLOWED_MIME_TYPES.includes(mimeType))
            return `MIME type "${mimeType}" is not allowed.`;
        return null;
    }
    async parse(buffer, filename, mimeType) {
        const validationError = this.validateFile(buffer, filename, mimeType);
        if (validationError)
            return { success: false, error: validationError };
        const ext = getExtension(filename);
        try {
            switch (ext) {
                case ".csv":
                    return { success: true, document: await (0, csv_parser_1.parseCsv)(buffer, filename) };
                case ".md":
                case ".txt":
                    return { success: true, document: await (0, text_parser_1.parseText)(buffer, filename) };
                case ".html":
                    return { success: true, document: await (0, html_parser_1.parseHtml)(buffer, filename) };
                default:
                    return { success: false, error: `Unsupported file type: ${ext}` };
            }
        }
        catch (error) {
            return {
                success: false,
                error: `Parse error: ${error instanceof Error ? error.message : "Unknown"}`,
            };
        }
    }
};
exports.DocumentParserService = DocumentParserService;
exports.DocumentParserService = DocumentParserService = __decorate([
    (0, common_1.Injectable)()
], DocumentParserService);
