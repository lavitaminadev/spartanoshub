import { Repository } from 'typeorm';
import { IntegrationAccount } from '../integration-account.entity';
import { IntegrationMetric } from '../integration-metric.entity';
export declare class MetaInsightsService {
    private readonly accounts;
    private readonly metrics;
    private readonly logger;
    constructor(accounts: Repository<IntegrationAccount>, metrics: Repository<IntegrationMetric>);
    sync(integrationId: string, organizationId: string): Promise<{
        synced: number;
        skippedUnassignedAccounts: string[];
        failedAccounts: string[];
    }>;
}
