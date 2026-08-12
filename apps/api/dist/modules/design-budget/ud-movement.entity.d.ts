import { UDBudget } from './ud-budget.entity';
import { Piece } from '../production/piece.entity';
export declare class UDMovement {
    id: string;
    udBudgetId: string;
    udBudget: UDBudget;
    pieceId?: string;
    piece?: Piece;
    type: string;
    amount: number;
    reason?: string;
    actorId?: string;
    createdAt: Date;
    updatedAt: Date;
}
