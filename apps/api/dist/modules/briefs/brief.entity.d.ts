import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
export declare class Brief {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId?: string;
    client?: Client;
    title: string;
    description?: string;
    requirements?: Record<string, any>;
    status: string;
    dueDate?: Date;
    createdAt: Date;
    updatedAt: Date;
}
