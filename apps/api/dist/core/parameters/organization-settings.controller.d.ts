import type { AuthenticatedRequest } from '../../shared/types/request';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { OrganizationSettingsService } from './organization-settings.service';
export declare class OrganizationSettingsController {
    private readonly settings;
    constructor(settings: OrganizationSettingsService);
    list(request: AuthenticatedRequest): Promise<{
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
    update(request: AuthenticatedRequest, dto: UpdateOrganizationSettingsDto): Promise<{
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
}
