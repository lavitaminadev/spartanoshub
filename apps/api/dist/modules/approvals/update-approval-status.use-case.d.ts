import { EventEmitter2 } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { ApprovalRequest } from './approval-request.entity';
import { UserRole } from '../organizations/user-role.enum';
import { PieceRulesService } from '../production/piece-rules.service';
export declare class UpdateApprovalStatusUseCase {
    private repo;
    private readonly pieceRules;
    private readonly events;
    constructor(repo: Repository<ApprovalRequest>, pieceRules: PieceRulesService, events: EventEmitter2);
    execute(id: string, organizationId: string, actor: {
        userId?: string;
        role: UserRole;
        clientId?: string;
    }, status: string, decisionNotes?: string): Promise<ApprovalRequest>;
}
