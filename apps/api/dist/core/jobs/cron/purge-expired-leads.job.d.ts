import { Repository } from 'typeorm';
import { Lead } from '../../../modules/crm/leads/lead.entity';
import { DataProtectionService } from '../../data-protection/data-protection.service';
export declare class PurgeExpiredLeadsJob {
    private readonly leadRepo;
    private readonly dataProtection;
    private readonly logger;
    constructor(leadRepo: Repository<Lead>, dataProtection: DataProtectionService);
    handle(): Promise<void>;
}
