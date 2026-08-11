import { Repository } from 'typeorm';
import { Client } from './client.entity';
import { User } from '../users/user.entity';
import { Lead } from '../crm/leads/lead.entity';
import { ClientCapabilities } from './client-capabilities';
export declare class CreateClientUseCase {
    private repo;
    private users;
    private leads;
    constructor(repo: Repository<Client>, users: Repository<User>, leads: Repository<Lead>);
    execute(data: {
        organizationId: string;
        name: string;
        legalName?: string;
        industry?: string;
        communityManagerId?: string;
        leadId?: string;
        retainerAmount?: number;
        currency?: string;
        defaultUdBudget?: number;
        capabilities?: Partial<ClientCapabilities>;
    }): Promise<Client>;
}
