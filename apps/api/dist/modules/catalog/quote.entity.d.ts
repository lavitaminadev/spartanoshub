import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { QuoteStatus } from './quote-status.enum';
import { Lead } from '../crm/leads/lead.entity';
export declare class Quote {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId?: string;
    client?: Client;
    leadId?: string;
    lead?: Lead;
    version: number;
    parentQuoteId?: string;
    sentAt?: Date;
    number: string;
    title: string;
    amount: number;
    currency: string;
    status: QuoteStatus;
    validUntil?: Date;
    acceptedAt?: Date;
    createdBy: string;
    items?: Record<string, any>[];
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
