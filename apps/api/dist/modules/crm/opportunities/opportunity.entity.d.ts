import { Organization } from '../../organizations/organization.entity';
export declare class Opportunity {
    id: string;
    organizationId: string;
    organization: Organization;
    leadId?: string;
    clientId?: string;
    name: string;
    amount?: number;
    stage: string;
    probability: number;
    expectedCloseDate?: Date;
    nextAction?: string;
    nextActionAt?: Date;
    lossReason?: string;
    lossNote?: string;
    assignedTo?: string;
    createdAt: Date;
    updatedAt: Date;
}
