import { Repository } from 'typeorm';
import { Lead } from '../leads/lead.entity';
import { Client } from '../../clients/client.entity';
import { User } from '../../users/user.entity';
interface OpportunityReferences {
    leadId?: string | null;
    clientId?: string | null;
    assignedTo?: string;
}
export declare class OpportunityReferenceValidator {
    private readonly leads;
    private readonly clients;
    private readonly users;
    constructor(leads: Repository<Lead>, clients: Repository<Client>, users: Repository<User>);
    validate(dto: OpportunityReferences, organizationId: string): Promise<void>;
}
export {};
