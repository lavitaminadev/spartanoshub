import { EntityManager, Repository } from 'typeorm';
import { ChargeNote } from './charge-note.entity';
export declare class BillingService {
    private readonly chargeNotes;
    constructor(chargeNotes: Repository<ChargeNote>);
    createCorrectionCharge(params: {
        organizationId: string;
        clientId: string;
        pieceId: string;
        correctionId: string;
        correctionNumber: number;
        createdBy?: string;
    }, manager?: EntityManager): Promise<ChargeNote>;
}
