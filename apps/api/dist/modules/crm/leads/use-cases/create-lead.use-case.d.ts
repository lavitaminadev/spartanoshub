import { LeadIntakeService } from '../lead-intake.service';
export declare class CreateLeadUseCase {
    private readonly leadIntake;
    constructor(leadIntake: LeadIntakeService);
    execute(data: {
        organizationId: string;
        name: string;
        email?: string;
        phone?: string;
        company?: string;
        source?: string;
        sourceDetail?: string;
        notes?: string;
    }): Promise<import("../lead.entity").Lead>;
}
