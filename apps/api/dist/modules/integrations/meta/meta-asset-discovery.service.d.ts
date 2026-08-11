import { Repository } from 'typeorm';
import { Integration } from '../integration.entity';
import { IntegrationAccount } from '../integration-account.entity';
import type { MetaAssetSelectionDto } from './dto/meta-integration.dto';
import { MetaIntegrationAccessor } from './meta-integration-accessor.service';
export declare class MetaAssetDiscoveryService {
    private readonly integrations;
    private readonly accounts;
    private readonly accessor;
    constructor(integrations: Repository<Integration>, accounts: Repository<IntegrationAccount>, accessor: MetaIntegrationAccessor);
    discoverAssets(integrationId: string, organizationId: string): Promise<MetaAssetsResponse>;
    getAssets(integrationId: string, organizationId: string): Promise<MetaAssetsResponse>;
    saveSelectedAssets(integrationId: string, organizationId: string, selection: MetaAssetSelectionDto): Promise<{
        saved: boolean;
        assets: MetaAssetsResponse;
    }>;
    subscribeSelectedPages(pages: IntegrationAccount[]): Promise<void>;
    unsubscribePages(pages: IntegrationAccount[]): Promise<void>;
    private fetchGraph;
    private syncDiscoveredAssets;
    private validateAssetSelection;
    private validatePrimary;
    private assertPagesAreExclusive;
}
export interface MetaAssetsResponse {
    pages: Array<{
        recordId: string;
        id: string;
        name: string;
        selected: boolean;
        category?: string;
    }>;
    instagramProfiles: Array<{
        recordId: string;
        id: string;
        name: string;
        selected: boolean;
        pageId?: string;
    }>;
    adAccounts: Array<{
        recordId: string;
        id: string;
        name: string;
        selected: boolean;
        clientId?: string;
        accountStatus?: number;
        currency?: string;
        timezoneName?: string;
    }>;
}
