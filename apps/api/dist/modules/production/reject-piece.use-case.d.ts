import { Repository } from 'typeorm';
import { Piece } from './piece.entity';
import { Correction } from './correction.entity';
import { CorrectionOrigin } from './correction-origin.enum';
import { PieceRulesService } from './piece-rules.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UserRole } from '../organizations/user-role.enum';
export declare class RejectPieceUseCase {
    private pieceRepo;
    private pieceRules;
    private eventEmitter;
    constructor(pieceRepo: Repository<Piece>, pieceRules: PieceRulesService, eventEmitter: EventEmitter2);
    execute(pieceId: string, organizationId: string, data: {
        versionId?: string;
        comment: string;
        origin: CorrectionOrigin;
        userId: string;
        role: UserRole;
        clientId?: string;
    }): Promise<Correction>;
}
