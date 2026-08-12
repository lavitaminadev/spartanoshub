import { Repository } from 'typeorm';
import { Lead } from '../lead.entity';
import { Client } from '../../../clients/client.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class ConvertLeadUseCase {
    private leadRepo;
    private clientRepo;
    private eventEmitter;
    constructor(leadRepo: Repository<Lead>, clientRepo: Repository<Client>, eventEmitter: EventEmitter2);
    execute(leadId: string, organizationId: string): Promise<{
        lead: Lead;
        client: Client;
    }>;
}
