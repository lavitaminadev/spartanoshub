import { Organization } from '../../organizations/organization.entity';
export declare class Interaction {
    id: string;
    organizationId: string;
    organization: Organization;
    leadId?: string;
    contactId?: string;
    type: string;
    description?: string;
    date: Date;
    createdBy?: string;
    createdAt: Date;
}
