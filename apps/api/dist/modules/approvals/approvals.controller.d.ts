import { Repository } from 'typeorm';
import { ListApprovalsUseCase } from './list-approvals.use-case';
import { UpdateApprovalStatusUseCase } from './update-approval-status.use-case';
import { UpdateApprovalDto } from './dto/update-approval.dto';
import { ApprovalRequest } from './approval-request.entity';
import { ApprovalRequestStatus } from './approval-request-status.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { Client } from '../clients/client.entity';
import { Piece } from '../production/piece.entity';
import { AccountAccessService } from '../../core/client-scope/account-access.service';
export declare class ApprovalsController {
    private listApprovals;
    private updateStatus;
    private repo;
    private clients;
    private pieces;
    private readonly accountAccess;
    constructor(listApprovals: ListApprovalsUseCase, updateStatus: UpdateApprovalStatusUseCase, repo: Repository<ApprovalRequest>, clients: Repository<Client>, pieces: Repository<Piece>, accountAccess: AccountAccessService);
    create(dto: CreateApprovalDto, req: AuthenticatedRequest): Promise<ApprovalRequest>;
    list(req: AuthenticatedRequest): Promise<{
        id: string;
        pieceId: string;
        pieceTitle: string;
        clientName: string;
        requestedBy: string;
        description: string | undefined;
        status: ApprovalRequestStatus;
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
            status: ApprovalRequestStatus;
            notes: string | undefined;
            requestedAt: string;
            decidedAt: string | undefined;
            requestedBy: string;
        }[];
    }[]>;
    update(id: string, dto: UpdateApprovalDto, req: AuthenticatedRequest): Promise<ApprovalRequest>;
}
