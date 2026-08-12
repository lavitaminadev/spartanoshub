import { Piece } from '../production/piece.entity';
export declare class XPEvent {
    id: string;
    xpPeriodId: string;
    userId?: string;
    pieceId?: string;
    piece?: Piece;
    eventType: string;
    points: number;
    description?: string;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
