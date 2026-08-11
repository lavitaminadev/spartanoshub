import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
import { GetOpportunityUseCase } from './get-opportunity.use-case';
export declare class RemoveOpportunityUseCase {
    private readonly repo;
    private readonly getOpportunity;
    constructor(repo: Repository<Opportunity>, getOpportunity: GetOpportunityUseCase);
    execute(id: string, organizationId: string): Promise<Opportunity>;
}
