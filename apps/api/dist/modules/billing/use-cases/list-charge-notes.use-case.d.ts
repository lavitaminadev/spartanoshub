import { Repository } from 'typeorm';
import { ChargeNote } from '../charge-note.entity';
export declare class ListChargeNotesUseCase {
    private readonly repo;
    constructor(repo: Repository<ChargeNote>);
    execute(organizationId: string): Promise<ChargeNote[]>;
}
