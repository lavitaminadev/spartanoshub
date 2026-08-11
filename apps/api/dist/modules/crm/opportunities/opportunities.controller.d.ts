import { CreateOpportunityUseCase } from './use-cases/create-opportunity.use-case';
import { ListOpportunitiesUseCase } from './use-cases/list-opportunities.use-case';
import { GetOpportunityUseCase } from './use-cases/get-opportunity.use-case';
import { UpdateOpportunityUseCase } from './use-cases/update-opportunity.use-case';
import { RemoveOpportunityUseCase } from './use-cases/remove-opportunity.use-case';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { ListOpportunitiesDto } from './dto/list-opportunities.dto';
import type { AuthenticatedRequest } from '@shared/types/request';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
export declare class OpportunitiesController {
    private createOpportunity;
    private listOpportunities;
    private getOpportunity;
    private updateOpportunity;
    private removeOpportunity;
    private readonly accountAccess;
    constructor(createOpportunity: CreateOpportunityUseCase, listOpportunities: ListOpportunitiesUseCase, getOpportunity: GetOpportunityUseCase, updateOpportunity: UpdateOpportunityUseCase, removeOpportunity: RemoveOpportunityUseCase, accountAccess: AccountAccessService);
    create(dto: CreateOpportunityDto, req: AuthenticatedRequest): Promise<import("./opportunity.entity").Opportunity>;
    findAll(query: ListOpportunitiesDto, req: AuthenticatedRequest): Promise<{
        data: import("./opportunity.entity").Opportunity[];
        total: number;
        limit: number;
        offset: number;
    }>;
    findOne(id: string, req: AuthenticatedRequest): Promise<import("./opportunity.entity").Opportunity>;
    update(id: string, dto: UpdateOpportunityDto, req: AuthenticatedRequest): Promise<import("./opportunity.entity").Opportunity>;
    remove(id: string, req: AuthenticatedRequest): Promise<import("./opportunity.entity").Opportunity>;
}
