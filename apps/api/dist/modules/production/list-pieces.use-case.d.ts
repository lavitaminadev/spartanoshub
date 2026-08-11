import { Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceStatus } from './piece-status.enum';
export declare class ListPiecesUseCase {
    private repo;
    constructor(repo: Repository<Piece>);
    execute(organizationId: string, status?: PieceStatus, clientId?: string, assignedTo?: string, clientIds?: string[], page?: number, limit?: number): Promise<{
        id: string;
        title: string;
        type: import("./piece-type.enum").PieceType;
        status: PieceStatus;
        udAmount: number;
        correctionCount: number;
        clientCorrectionCount: number;
        chargeNoteRequired: boolean;
        clientName: string;
        assignedTo: string | undefined;
        dueDate: string | undefined;
        dependencyIds: string[];
        createdAt: string;
        assignedAt: string | undefined;
        difficultyLevel: number;
    }[]>;
}
