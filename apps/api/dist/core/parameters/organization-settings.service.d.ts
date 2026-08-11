import { DataSource, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { ParameterDefinition } from './parameter-definition.entity';
import { ParameterResolver } from './parameter-resolver.service';
import { ParameterValue } from './parameter-value.entity';
export declare class OrganizationSettingsService {
    private readonly definitionRepo;
    private readonly valueRepo;
    private readonly dataSource;
    private readonly audit;
    private readonly resolver;
    constructor(definitionRepo: Repository<ParameterDefinition>, valueRepo: Repository<ParameterValue>, dataSource: DataSource, audit: AuditService, resolver: ParameterResolver);
    list(organizationId: string): Promise<{
        value: any;
        source: string;
        version: number;
        key: string;
        category: import("./organization-settings.catalog").OrganizationSettingCategory;
        label: string;
        description: string;
        valueType: import("./organization-settings.catalog").OrganizationSettingValueType;
        defaultValue: string | number | boolean | null;
        masterStatus: import("./organization-settings.catalog").MasterSettingStatus;
        options?: import("./organization-settings.catalog").OrganizationSettingOption[];
        min?: number;
        max?: number;
        unit?: string;
        nullable?: boolean;
    }[]>;
    update(organizationId: string, actorId: string, requestedValues: Record<string, unknown>): Promise<{
        value: any;
        source: string;
        version: number;
        key: string;
        category: import("./organization-settings.catalog").OrganizationSettingCategory;
        label: string;
        description: string;
        valueType: import("./organization-settings.catalog").OrganizationSettingValueType;
        defaultValue: string | number | boolean | null;
        masterStatus: import("./organization-settings.catalog").MasterSettingStatus;
        options?: import("./organization-settings.catalog").OrganizationSettingOption[];
        min?: number;
        max?: number;
        unit?: string;
        nullable?: boolean;
    }[]>;
    private ensureDefinitions;
}
