export declare class PublicLeadConsentDto {
    privacyAccepted: boolean;
    marketingAccepted?: boolean;
    policyVersion?: string;
}
export declare class PublicLeadTrackingDto {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    fbclid?: string;
    gclid?: string;
    landingUrl?: string;
    referrer?: string;
}
export declare class PublicLeadSubmissionDto {
    name: string;
    email?: string;
    phone?: string;
    company?: string;
    website?: string;
    jobTitle?: string;
    serviceInterest?: string;
    budgetRange?: string;
    message?: string;
    consent: PublicLeadConsentDto;
    tracking?: PublicLeadTrackingDto;
    company_website_confirm?: string;
    idempotencyKey: string;
}
