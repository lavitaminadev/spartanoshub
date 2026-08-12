import { Piece } from './piece.entity';
import { PieceVersion } from './piece-version.entity';
import { CorrectionOrigin } from './correction-origin.enum';
export declare class Correction {
    id: string;
    pieceId: string;
    piece: Piece;
    pieceVersionId?: string;
    pieceVersion?: PieceVersion;
    origin: CorrectionOrigin;
    description: string;
    requestedBy?: string;
    billableExtra: boolean;
    chargeNoteRequired: boolean;
    resolvedBy?: string;
    resolvedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
