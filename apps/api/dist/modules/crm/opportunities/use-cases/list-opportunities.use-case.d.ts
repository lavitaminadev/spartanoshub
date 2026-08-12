import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
export declare class ListOpportunitiesUseCase {
    private readonly repo;
    constructor(repo: Repository<Opportunity>);
    execute(organizationId: string, limit?: number, offset?: number, leadId?: string, allowedClientIds?: string[]): Promise<{
        data: Opportunity[];
        total: number;
        limit: number;
        offset: number;
    }>;
}
