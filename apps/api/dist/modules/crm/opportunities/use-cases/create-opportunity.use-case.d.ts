import { Repository } from 'typeorm';
import { Opportunity } from '../opportunity.entity';
import { CreateOpportunityDto } from '../dto/create-opportunity.dto';
import { OpportunityReferenceValidator } from '../opportunity-reference-validator.service';
export declare class CreateOpportunityUseCase {
    private readonly repo;
    private readonly referenceValidator;
    constructor(repo: Repository<Opportunity>, referenceValidator: OpportunityReferenceValidator);
    execute(dto: CreateOpportunityDto, organizationId: string): Promise<Opportunity>;
}
