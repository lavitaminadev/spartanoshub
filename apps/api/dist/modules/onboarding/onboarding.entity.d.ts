import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
export declare class Onboarding {
    id: string;
    clientId: string;
    client: Client;
    organizationId: string;
    organization: Organization;
    step: string;
    status: string;
    assignedTo?: string;
    assignee?: User;
    completedAt?: Date;
    notes?: string;
    blockedReason?: string;
    requiredDocuments?: string[];
    receivedDocuments?: string[];
    createdAt: Date;
    updatedAt: Date;
}
