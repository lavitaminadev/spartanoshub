import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { Integration } from '../integrations/integration.entity';
export declare class GoogleDriveService {
    private readonly clients;
    private readonly integrations;
    constructor(clients: Repository<Client>, integrations: Repository<Integration>);
    bootstrapClient(organizationId: string, clientId: string): Promise<{
        rootId: string;
        rootUrl: string;
        folders: Record<string, string>;
    }>;
    private ensureFolder;
    private driveFetch;
}
