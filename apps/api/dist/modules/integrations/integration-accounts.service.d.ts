import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { IntegrationAccount } from './integration-account.entity';
export declare class IntegrationAccountsService {
    private readonly accounts;
    private readonly clients;
    constructor(accounts: Repository<IntegrationAccount>, clients: Repository<Client>);
    assignClient(accountId: string, clientId: string | undefined, organizationId: string): Promise<{
        id: string;
        integrationId: string;
        integration: import("./integration.entity").Integration;
        accountType: import("./integration-account-type.enum").IntegrationAccountType;
        externalId: string;
        externalName: string;
        tokenExpiresAt?: Date;
        metadata?: Record<string, any>;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
