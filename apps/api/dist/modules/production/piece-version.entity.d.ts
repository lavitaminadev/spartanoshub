import { Piece } from './piece.entity';
export declare class PieceVersion {
    id: string;
    pieceId: string;
    piece: Piece;
    versionNumber: number;
    fileName: string;
    driveFileId?: string;
    stateLabel?: string;
    isFinal: boolean;
    namingValid?: boolean;
    namingErrors?: string[];
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
