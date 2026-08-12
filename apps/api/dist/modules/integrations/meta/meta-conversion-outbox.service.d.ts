import { Repository } from 'typeorm';
import { ConversionEvent, MetaConversionsService } from './meta-conversions.service';
import { MetaConversionOutbox } from './meta-conversion-outbox.entity';
import { MetaClientPixelService } from './meta-client-pixel.service';
export declare class MetaConversionOutboxService {
    private readonly outbox;
    private readonly conversions;
    private readonly clientPixels;
    private readonly logger;
    constructor(outbox: Repository<MetaConversionOutbox>, conversions: MetaConversionsService, clientPixels: MetaClientPixelService);
    enqueue(organizationId: string, pixelId: string, event: ConversionEvent): Promise<MetaConversionOutbox>;
    stats(organizationId?: string): Promise<{
        pending: number;
        retry: number;
        processing: number;
        failed: number;
        expired: number;
        processed: number;
        total: number;
    }>;
    recentProblems(organizationId: string, limit?: number): Promise<MetaConversionOutbox[]>;
    private releaseStaleClaims;
    private claimBatch;
    processPending(limit?: number): Promise<{
        processed: number;
        failed: number;
    }>;
    cleanup(olderThanDays?: number): Promise<{
        deleted: number;
    }>;
}
