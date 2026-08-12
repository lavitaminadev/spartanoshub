export interface InferredLocation {
    country?: string;
    region?: string;
    city?: string;
}
export declare function normalizeGeoValue(value: string): string;
export declare function inferLocationFromPhone(phone: string | null | undefined, defaultCountryPrefix?: string): InferredLocation;
