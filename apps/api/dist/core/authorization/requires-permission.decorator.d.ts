import type { OrganizationFeatureKey } from '../../modules/organizations/organization-features';
import type { PermissionLevel } from './permission-level';
export declare const REQUIRES_PERMISSION_KEY = "requiresPermission";
export interface RequiredPermission {
    module: OrganizationFeatureKey;
    level: PermissionLevel;
}
export declare const RequiresPermission: (module: OrganizationFeatureKey, level: PermissionLevel) => import("@nestjs/common").CustomDecorator<string>;
