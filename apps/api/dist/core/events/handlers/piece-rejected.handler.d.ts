import { Repository } from 'typeorm';
import { BillingService } from '../../../modules/billing/billing.service';
import { Correction } from '../../../modules/production/correction.entity';
import { Piece } from '../../../modules/production/piece.entity';
export declare class PieceRejectedHandler {
    private readonly corrections;
    private readonly pieces;
    private readonly billing;
    private readonly logger;
    constructor(corrections: Repository<Correction>, pieces: Repository<Piece>, billing: BillingService);
    handle(payload: {
        organizationId: string;
        pieceId: string;
        correctionId: string;
        requestedBy?: string;
    }): Promise<void>;
}
