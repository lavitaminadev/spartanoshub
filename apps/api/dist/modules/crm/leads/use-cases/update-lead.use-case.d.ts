import { Repository } from 'typeorm';
import { Lead } from '../lead.entity';
export declare class UpdateLeadUseCase {
    private repo;
    constructor(repo: Repository<Lead>);
    execute(id: string, data: {
        status?: string;
        notes?: string;
        fitStatus?: string;
        discardReason?: string;
        tags?: string[];
    }, organizationId: string): Promise<Lead>;
}
