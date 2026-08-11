import type { ParsedDocument } from "./document-types";
export type ParseResult = {
    success: boolean;
    document?: ParsedDocument;
    error?: string;
};
export declare class DocumentParserService {
    validateFile(buffer: Buffer, filename: string, mimeType?: string): string | null;
    parse(buffer: Buffer, filename: string, mimeType?: string): Promise<ParseResult>;
}
