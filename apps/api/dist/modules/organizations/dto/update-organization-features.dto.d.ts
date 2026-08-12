import { OrganizationFeatures } from '../organization-features';
export declare class UpdateOrganizationFeaturesDto {
    features: Partial<OrganizationFeatures>;
    static validateKeys(features: Record<string, unknown>): string[];
    static get allowedKeys(): readonly string[];
}
