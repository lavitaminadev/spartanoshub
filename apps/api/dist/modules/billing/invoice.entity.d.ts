import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
export declare class Invoice {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId: string;
    client: Client;
    number: string;
    issuedAt: Date;
    dueAt: Date;
    paidAt?: Date;
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    status: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
