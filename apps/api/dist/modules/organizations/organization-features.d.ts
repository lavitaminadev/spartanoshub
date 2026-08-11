import { type OrganizationModuleKey } from '@espartanos/shared';
export declare const ORGANIZATION_FEATURE_KEYS: readonly OrganizationModuleKey[];
export type OrganizationFeatureKey = OrganizationModuleKey;
export type OrganizationFeatures = Record<OrganizationFeatureKey, boolean>;
export declare const DEFAULT_ORGANIZATION_FEATURES: OrganizationFeatures;
export declare function normalizeOrganizationFeatures(value?: Partial<OrganizationFeatures> | null): OrganizationFeatures;
export declare function isOrganizationFeatureKey(value: string): value is OrganizationFeatureKey;
