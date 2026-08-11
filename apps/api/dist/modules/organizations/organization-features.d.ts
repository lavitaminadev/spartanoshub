export declare const ORGANIZATION_FEATURE_KEYS: readonly ["dashboard", "clients", "users", "reservations", "crm", "integrations", "settings", "clientMetricsPanel", "multiClientOnboarding", "production", "udBudget", "gamification", "billing", "contracts", "catalog", "content", "briefs", "meetings", "documents", "approvals", "audiovisual", "knowledge", "reports", "onboarding", "operations", "governance", "direction", "commercialPipeline"];
export type OrganizationFeatureKey = (typeof ORGANIZATION_FEATURE_KEYS)[number];
export type OrganizationFeatures = Record<OrganizationFeatureKey, boolean>;
export declare const DEFAULT_ORGANIZATION_FEATURES: OrganizationFeatures;
export declare function normalizeOrganizationFeatures(value?: Partial<OrganizationFeatures> | null): OrganizationFeatures;
export declare function isOrganizationFeatureKey(value: string): value is OrganizationFeatureKey;
