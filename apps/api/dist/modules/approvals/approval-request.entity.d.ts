import { Organization } from '../organizations/organization.entity';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
import { ApprovalRequestStatus } from './approval-request-status.enum';
export declare class ApprovalRequest {
    id: string;
    organizationId: string;
    organization: Organization;
    clientId?: string;
    client?: Client;
    title: string;
    description?: string;
    entityType: string;
    entityId: string;
    requestedBy: string;
    requestedByUser: User;
    assignedTo?: string;
    status: ApprovalRequestStatus;
    decisionAt?: Date;
    decisionNotes?: string;
    dueAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
