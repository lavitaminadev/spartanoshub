import { LeadIntakeService } from './lead-intake.service';
import { PublicLeadSubmissionDto } from './dto/public-lead-submission.dto';
export declare class PublicAgencyLeadsController {
    private readonly leadIntake;
    constructor(leadIntake: LeadIntakeService);
    private agencyOrganizationId;
    submit(dto: PublicLeadSubmissionDto): Promise<{
        success: boolean;
        submissionId: `${string}-${string}-${string}-${string}-${string}`;
        message: string;
    }>;
}
