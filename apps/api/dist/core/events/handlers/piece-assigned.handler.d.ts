import { Repository } from 'typeorm';
import { Piece } from '../../../modules/production/piece.entity';
import { Notification } from '../../notifications/notification.entity';
export declare class PieceAssignedHandler {
    private pieceRepo;
    private notifRepo;
    private readonly logger;
    constructor(pieceRepo: Repository<Piece>, notifRepo: Repository<Notification>);
    handle(payload: {
        organizationId: string;
        pieceId: string;
        designerId: string;
    }): Promise<void>;
}
