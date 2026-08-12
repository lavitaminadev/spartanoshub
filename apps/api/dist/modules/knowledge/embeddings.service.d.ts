import { HttpService } from "@nestjs/axios";
export declare class EmbeddingsService {
    private readonly http;
    constructor(http: HttpService);
    create(text: string): Promise<number[]>;
    createBatch(texts: string[]): Promise<number[][]>;
}
