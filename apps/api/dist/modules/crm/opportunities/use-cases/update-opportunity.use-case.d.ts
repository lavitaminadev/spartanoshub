import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
import { UpdateOpportunityDto } from '../dto/update-opportunity.dto';
import { OpportunityReferenceValidator } from '../opportunity-reference-validator.service';
import { GetOpportunityUseCase } from './get-opportunity.use-case';
export declare class UpdateOpportunityUseCase {
    private readonly repo;
    private readonly referenceValidator;
    private readonly getOpportunity;
    constructor(repo: Repository<Opportunity>, referenceValidator: OpportunityReferenceValidator, getOpportunity: GetOpportunityUseCase);
    execute(id: string, dto: UpdateOpportunityDto, organizationId: string): Promise<Opportunity>;
}
