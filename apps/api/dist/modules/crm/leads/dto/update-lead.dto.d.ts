import { LeadStatus } from '../lead-status.enum';
import { LeadFitStatus } from '../lead-fit-status.enum';
export declare class UpdateLeadDto {
    status?: LeadStatus;
    fitStatus?: LeadFitStatus;
    discardReason?: string;
    notes?: string;
    tags?: string[];
}
