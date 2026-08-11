import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationAccountType } from '../integration-account-type.enum';
import { IntegrationMetric } from '../integration-metric.entity';
import { Client } from '../../clients/client.entity';
import { GoogleOAuthService } from './google-oauth.service';
export declare class GoogleDataService {
    private readonly integrations;
    private readonly accounts;
    private readonly metrics;
    private readonly clients;
    private readonly oauth;
    constructor(integrations: Repository<Integration>, accounts: Repository<IntegrationAccount>, metrics: Repository<IntegrationMetric>, clients: Repository<Client>, oauth: GoogleOAuthService);
    listAccounts(integrationId: string, organizationId: string): Promise<{
        id: string;
        externalId: string;
        name: string;
        type: IntegrationAccountType;
        selected: boolean;
        clientId: string | null;
    }[]>;
    discoverAdsAccounts(integrationId: string, organizationId: string): Promise<{
        id: string;
        externalId: string;
        name: string;
        selected: boolean;
        clientId: any;
    }[]>;
    registerAnalyticsProperty(integrationId: string, organizationId: string, propertyId: string, name: string, clientId: string): Promise<IntegrationAccount>;
    sync(integrationId: string, organizationId: string): Promise<{
        synced: number;
        skippedUnassignedAccounts: string[];
        failedAccounts: string[];
    }>;
    private syncAdsAccount;
    private syncAnalyticsProperty;
    private upsertMetrics;
    private getAccess;
    private getIntegration;
    private adsApiVersion;
    private adsHeaders;
    private googleFetch;
}
