import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
export declare class GetOpportunityUseCase {
    private readonly repo;
    constructor(repo: Repository<Opportunity>);
    execute(id: string, organizationId: string, allowedClientIds?: string[]): Promise<Opportunity>;
}
