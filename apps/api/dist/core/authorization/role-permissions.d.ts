import { UserRole } from '../../modules/organizations/user-role.enum';
import { OrganizationFeatureKey } from '../../modules/organizations/organization-features';
import { PermissionLevel } from './permission-level';
type RoleModuleMap = Partial<Record<OrganizationFeatureKey, PermissionLevel>>;
export declare const ROLE_PERMISSIONS: Record<UserRole, RoleModuleMap>;
export declare function roleLevel(role: UserRole, module: OrganizationFeatureKey): PermissionLevel;
export {};
