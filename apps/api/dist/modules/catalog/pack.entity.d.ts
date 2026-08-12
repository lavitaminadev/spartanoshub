import { Organization } from '../organizations/organization.entity';
export declare class Pack {
    id: string;
    organizationId: string;
    organization: Organization;
    name: string;
    description?: string;
    monthlyUd: number;
    reelsIncluded: number;
    monthlyPrice?: number;
    currency: string;
    services?: string;
    status: string;
    createdAt: Date;
}
