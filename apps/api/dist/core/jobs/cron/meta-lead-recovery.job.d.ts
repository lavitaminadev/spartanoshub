import { Repository } from 'typeorm';
import { MetaLeadAdsService } from '../../../modules/integrations/meta/meta-lead-ads.service';
import { IntegrationAccount } from '../../../modules/integrations/integration-account.entity';
export declare class MetaLeadRecoveryJob {
    private readonly accountsRepo;
    private readonly metaLeadAdsService;
    private readonly logger;
    constructor(accountsRepo: Repository<IntegrationAccount>, metaLeadAdsService: MetaLeadAdsService);
    handle(): Promise<void>;
}
