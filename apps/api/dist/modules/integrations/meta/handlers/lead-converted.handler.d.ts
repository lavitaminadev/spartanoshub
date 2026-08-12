import { Repository } from 'typeorm';
import { MetaConversionOutboxService } from '../meta-conversion-outbox.service';
import { MetaClientPixelService } from '../meta-client-pixel.service';
import { IntegrationAccount } from '../../integration-account.entity';
import { Lead } from '../../../crm/leads/lead.entity';
import { Client } from '../../../clients/client.entity';
export declare class LeadConvertedHandler {
    private readonly outbox;
    private readonly clientPixels;
    private readonly accountsRepo;
    private readonly leadRepo;
    private readonly clientRepo;
    private readonly logger;
    constructor(outbox: MetaConversionOutboxService, clientPixels: MetaClientPixelService, accountsRepo: Repository<IntegrationAccount>, leadRepo: Repository<Lead>, clientRepo: Repository<Client>);
    handleLeadConvertedEvent(payload: {
        organizationId: string;
        leadId: string;
        clientId: string;
    }): Promise<void>;
}
