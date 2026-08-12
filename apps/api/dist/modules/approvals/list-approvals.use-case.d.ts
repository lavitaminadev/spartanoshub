import { Repository } from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { PieceVersion } from '../production/piece-version.entity';
export declare class ListApprovalsUseCase {
    private repo;
    private versionRepo;
    constructor(repo: Repository<ApprovalRequest>, versionRepo: Repository<PieceVersion>);
    execute(organizationId: string, clientId?: string, clientIds?: string[]): Promise<{
        id: string;
        pieceId: string;
        pieceTitle: string;
        clientName: string;
        requestedBy: string;
        description: string | undefined;
        status: import("./approval-request-status.enum").ApprovalRequestStatus;
        createdAt: string;
        decisionNotes: string | undefined;
        dueAt: string | undefined;
        versionUrl: string | undefined;
        versions: {
            id: string;
            number: number;
            fileName: string;
            url: string | undefined;
            state: string | undefined;
            createdAt: string;
            namingValid: boolean | undefined;
        }[];
        decisionHistory: {
            id: string;
            status: import("./approval-request-status.enum").ApprovalRequestStatus;
            notes: string | undefined;
            requestedAt: string;
            decidedAt: string | undefined;
            requestedBy: string;
        }[];
    }[]>;
}
