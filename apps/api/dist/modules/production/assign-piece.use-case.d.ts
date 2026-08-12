import { Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DesignBudgetService } from '../design-budget/design-budget.service';
import { User } from '../users/user.entity';
export declare class AssignPieceUseCase {
    private repo;
    private users;
    private designBudget;
    private eventEmitter;
    constructor(repo: Repository<Piece>, users: Repository<User>, designBudget: DesignBudgetService, eventEmitter: EventEmitter2);
    execute(pieceId: string, designerId: string, organizationId: string, actorId?: string): Promise<Piece>;
}
