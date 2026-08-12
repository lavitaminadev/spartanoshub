import { HttpService } from '@nestjs/axios';
interface MetaPixelStats {
    data?: Array<Record<string, unknown>>;
}
export declare class MetaPixelService {
    private readonly http;
    private readonly logger;
    constructor(http: HttpService);
    validatePixel(pixelId: string, accessToken: string): Promise<boolean>;
    getPixelStats(pixelId: string, accessToken: string): Promise<MetaPixelStats | null>;
}
export {};
