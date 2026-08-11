import { Repository } from 'typeorm';
import { GoogleConversionOutbox } from './google-conversion-outbox.entity';
import { GoogleClickConversion, GoogleConversionsService } from './google-conversions.service';
import { Integration } from '../integration.entity';
import { IntegrationAccount } from '../integration-account.entity';
import { GoogleOAuthService } from './google-oauth.service';
export interface ResolvedAdsConversionConfig {
    customerId: string;
    conversionAction: string;
}
export declare class GoogleConversionOutboxService {
    private readonly outbox;
    private readonly integrations;
    private readonly accounts;
    private readonly conversions;
    private readonly oauth;
    private readonly logger;
    constructor(outbox: Repository<GoogleConversionOutbox>, integrations: Repository<Integration>, accounts: Repository<IntegrationAccount>, conversions: GoogleConversionsService, oauth: GoogleOAuthService);
    resolveConfig(organizationId: string, clientId: string, eventKey: string): Promise<ResolvedAdsConversionConfig | null>;
    enqueue(organizationId: string, config: ResolvedAdsConversionConfig, eventId: string, conversion: Omit<GoogleClickConversion, 'conversionAction'>): Promise<GoogleConversionOutbox>;
    stats(): Promise<{
        pending: number;
        retry: number;
        processing: number;
        failed: number;
        processed: number;
        total: number;
    }>;
    private claimBatch;
    processPending(limit?: number): Promise<{
        processed: number;
        failed: number;
    }>;
    cleanup(olderThanDays?: number): Promise<{
        deleted: number;
    }>;
    private resolveAccessToken;
}
