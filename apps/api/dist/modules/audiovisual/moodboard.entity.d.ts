import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
export declare class Moodboard {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId: string;
    client: Client;
    title: string;
    description?: string;
    images?: string[];
    createdBy?: string;
    verifiedBy?: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
}
