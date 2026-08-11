import type { OrganizationFeatureKey } from '../../modules/organizations/organization-features';
export declare const REQUIRES_FEATURE_KEY = "requiresFeature";
export declare const RequiresFeature: (feature: OrganizationFeatureKey) => import("@nestjs/common").CustomDecorator<string>;
