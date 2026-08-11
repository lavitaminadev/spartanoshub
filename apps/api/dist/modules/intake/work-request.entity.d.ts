import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';
export declare enum WorkRequestArea {
    DESIGN = "design",
    AUDIOVISUAL = "audiovisual",
    COMMUNITY = "community"
}
export declare enum WorkRequestStatus {
    NEW = "new",
    IN_REVIEW = "in_review",
    ACCEPTED = "accepted",
    CONVERTED = "converted",
    REJECTED = "rejected"
}
export declare const WORK_REQUEST_PRIORITIES: readonly ["low", "normal", "high", "urgent"];
export type WorkRequestPriority = (typeof WORK_REQUEST_PRIORITIES)[number];
export declare class WorkRequest {
    id: string;
    organizationId: string;
    clientId: string;
    client?: Client;
    code: string;
    area: WorkRequestArea;
    title: string;
    description?: string | null;
    priority: WorkRequestPriority;
    status: WorkRequestStatus;
    neededBy?: Date | null;
    requestedBy: string;
    requester?: User;
    assignedTo?: string | null;
    assignee?: User | null;
    creativeFields?: Record<string, unknown> | null;
    operationalFields?: Record<string, unknown> | null;
    rejectionReason?: string | null;
    pieceIds?: string[] | null;
    sessionId?: string | null;
    reviewedAt?: Date | null;
    resolvedAt?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}
