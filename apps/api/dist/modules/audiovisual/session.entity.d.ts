import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
export declare class Session {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId: string;
    client: Client;
    type: string;
    date: Date;
    location?: string;
    assignedTeam?: string[];
    moodboardId?: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}
