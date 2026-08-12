import { Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DesignBudgetService } from '../design-budget/design-budget.service';
import { XPService } from '../gamification/xp.service';
export declare class DeliverPieceUseCase {
    private repo;
    private designBudget;
    private xp;
    private eventEmitter;
    constructor(repo: Repository<Piece>, designBudget: DesignBudgetService, xp: XPService, eventEmitter: EventEmitter2);
    execute(pieceId: string, organizationId: string, actorId?: string): Promise<Piece>;
}
