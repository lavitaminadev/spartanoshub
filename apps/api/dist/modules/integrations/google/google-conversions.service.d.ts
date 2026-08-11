export interface GoogleConversionUserData {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    country?: string;
    region?: string;
    city?: string;
}
export interface GoogleClickConversion {
    conversionAction: string;
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    orderId?: string;
    conversionDateTime: Date;
    timezone: string;
    conversionValue?: number;
    currencyCode?: string;
    userData: GoogleConversionUserData;
}
export declare function normalizePhoneForGoogle(phone: string): string;
export declare function formatConversionDateTime(date: Date, timezone: string): string;
export declare function buildUserIdentifiers(userData: GoogleConversionUserData): Array<Record<string, unknown>>;
export declare class GoogleConversionsService {
    private readonly logger;
    private adsApiVersion;
    private adsHeaders;
    buildPayload(conversion: GoogleClickConversion): Record<string, unknown>;
    uploadClickConversions(customerId: string, accessToken: string, conversions: GoogleClickConversion[]): Promise<{
        results: unknown[];
        partialFailureError?: unknown;
    }>;
}
