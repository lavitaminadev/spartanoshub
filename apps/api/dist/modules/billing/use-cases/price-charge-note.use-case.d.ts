import { Repository } from 'typeorm';
import { ChargeNote } from '../charge-note.entity';
export declare class PriceChargeNoteUseCase {
    private readonly repo;
    constructor(repo: Repository<ChargeNote>);
    execute(id: string, organizationId: string, amount: number): Promise<ChargeNote>;
}
