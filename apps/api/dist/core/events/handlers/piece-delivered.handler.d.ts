import { Repository } from 'typeorm';
import { Piece } from '../../../modules/production/piece.entity';
import { PieceVersion } from '../../../modules/production/piece-version.entity';
import { Client } from '../../../modules/clients/client.entity';
import { Notification } from '../../notifications/notification.entity';
export declare class PieceDeliveredHandler {
    private pieceRepo;
    private versionRepo;
    private clientRepo;
    private notifRepo;
    private readonly logger;
    constructor(pieceRepo: Repository<Piece>, versionRepo: Repository<PieceVersion>, clientRepo: Repository<Client>, notifRepo: Repository<Notification>);
    handle(payload: {
        organizationId: string;
        pieceId: string;
    }): Promise<void>;
}
