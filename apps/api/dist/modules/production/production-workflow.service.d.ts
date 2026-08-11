import { Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { PieceVersion } from './piece-version.entity';
import { Correction } from './correction.entity';
import { DesignBudgetService } from '../design-budget/design-budget.service';
import { XPService } from '../gamification/xp.service';
import { BillingService } from '../billing/billing.service';
import { PieceType } from './piece-type.enum';
export declare class ProductionWorkflowService {
    private pieceRepo;
    private versionRepo;
    private correctionRepo;
    private designBudget;
    private xp;
    private billing;
    constructor(pieceRepo: Repository<Piece>, versionRepo: Repository<PieceVersion>, correctionRepo: Repository<Correction>, designBudget: DesignBudgetService, xp: XPService, billing: BillingService);
    assign(piece: Piece, designerId: string, pieceType: PieceType, difficultyLevel: number, carouselSlides?: number, actorId?: string): Promise<void>;
    submitVersion(piece: Piece, fileName: string, driveFileId: string | undefined, userId: string): Promise<PieceVersion>;
    rejectByClient(piece: Piece, version: PieceVersion, comment: string, clientUserId: string): Promise<void>;
    deliver(piece: Piece, actorId?: string): Promise<void>;
    flagDesignerError(piece: Piece, version: PieceVersion, description: string, artDirectorId: string): Promise<void>;
}
