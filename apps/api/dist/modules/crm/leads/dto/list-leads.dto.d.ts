import { PaginationDto } from '../../../../shared/dto/pagination.dto';
import { LeadStatus } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';
export declare class ListLeadsQueryDto extends PaginationDto {
    status?: LeadStatus;
    fitStatus?: LeadFitStatus;
    source?: string;
    clientId?: string;
    domain?: 'audience' | 'commercial' | 'all';
}
