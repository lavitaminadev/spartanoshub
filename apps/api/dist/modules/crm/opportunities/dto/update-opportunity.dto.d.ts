export declare class UpdateOpportunityDto {
    name?: string;
    leadId?: string | null;
    clientId?: string | null;
    amount?: number;
    stage?: string;
    probability?: number;
    expectedCloseDate?: string;
    nextAction?: string | null;
    nextActionAt?: string | null;
    assignedTo?: string;
    lossReason?: string;
    lossNote?: string;
}
