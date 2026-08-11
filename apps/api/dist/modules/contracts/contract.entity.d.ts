import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
export declare class Contract {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId?: string;
    client?: Client;
    name: string;
    serviceType?: string;
    startDate: Date;
    endDate?: Date;
    monthlyUd: number;
    packId?: string;
    monthlyPrice: number;
    committedAdSpend: number;
    includedReels: number;
    billingCycle: string;
    status: string;
    terms?: string;
    createdAt: Date;
    updatedAt: Date;
}
