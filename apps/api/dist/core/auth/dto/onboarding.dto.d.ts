export declare const REQUIRED_CONSENTS: readonly ["terms", "dataTreatment", "confidentiality", "properUse", "noDisclosure"];
export declare const TERMS_VERSION = "v1";
export declare class OnboardingProfileDto {
    name: string;
    phone?: string;
}
export declare class CompleteOnboardingDto {
    newPassword: string;
    acceptedConsents: string[];
    profile: OnboardingProfileDto;
}
export declare class AcceptTermsDto {
    acceptedConsents: string[];
}
