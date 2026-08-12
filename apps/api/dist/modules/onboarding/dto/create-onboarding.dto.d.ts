export declare class CreateOnboardingDto {
    clientId: string;
    step: string;
    status?: string;
    assignedTo?: string;
    notes?: string;
    blockedReason?: string;
    requiredDocuments?: string[];
    receivedDocuments?: string[];
}
