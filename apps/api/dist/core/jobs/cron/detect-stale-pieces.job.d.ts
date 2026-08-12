import { Repository } from 'typeorm';
import { Piece } from '../../../modules/production/piece.entity';
import { Notification } from '../../notifications/notification.entity';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';
export declare class DetectStalePiecesJob {
    private pieceRepo;
    private notifRepo;
    private readonly parameters;
    private readonly logger;
    constructor(pieceRepo: Repository<Piece>, notifRepo: Repository<Notification>, parameters: ParameterResolver);
    handle(): Promise<void>;
}
