import { Organization } from '../../organizations/organization.entity';
import { Lead } from '../leads/lead.entity';
export declare class Contact {
    id: string;
    organizationId: string;
    organization: Organization;
    leadId: string;
    lead?: Lead;
    clientId?: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    position?: string;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}
