export type OrganizationSettingCategory = 'operation' | 'production' | 'design_budget' | 'meetings' | 'alerts' | 'documents' | 'compliance';
export type OrganizationSettingValueType = 'boolean' | 'number' | 'select' | 'text';
export type MasterSettingStatus = 'master_defined' | 'direction_required';
export interface OrganizationSettingOption {
    value: string;
    label: string;
}
export interface OrganizationSettingDefinition {
    key: string;
    category: OrganizationSettingCategory;
    label: string;
    description: string;
    valueType: OrganizationSettingValueType;
    defaultValue: string | number | boolean | null;
    masterStatus: MasterSettingStatus;
    options?: OrganizationSettingOption[];
    min?: number;
    max?: number;
    unit?: string;
    nullable?: boolean;
}
export declare const ORGANIZATION_SETTINGS: readonly OrganizationSettingDefinition[];
export declare function validateOrganizationSettingValue(definition: OrganizationSettingDefinition, value: unknown): string | number | boolean | null;
