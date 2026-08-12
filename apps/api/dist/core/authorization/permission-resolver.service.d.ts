import { Repository } from 'typeorm';
import { Organization } from '../../modules/organizations/organization.entity';
import { OrganizationFeatureKey } from '../../modules/organizations/organization-features';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { UserPermissionOverride } from './user-permission-override.entity';
import { PermissionLevel } from './permission-level';
import { ParameterResolver } from '../parameters/parameter-resolver.service';
export interface EffectivePermission {
    module: OrganizationFeatureKey;
    level: PermissionLevel;
    source: 'role' | 'override';
    moduleDisabled: boolean;
    productHidden: boolean;
}
export type PermissionMap = Record<OrganizationFeatureKey, PermissionLevel>;
export declare class PermissionResolverService {
    private readonly organizations;
    private readonly overrides;
    private readonly parameters?;
    private static readonly CACHE_TTL_MS;
    private readonly cache;
    constructor(organizations: Repository<Organization>, overrides: Repository<UserPermissionOverride>, parameters?: ParameterResolver | undefined);
    permissionsFor(organizationId: string, userId: string, role: UserRole): Promise<PermissionMap>;
    explain(organizationId: string, userId: string, role: UserRole): Promise<EffectivePermission[]>;
    can(organizationId: string, userId: string, role: UserRole, module: string, required: PermissionLevel): Promise<boolean>;
    invalidateUser(userId: string): void;
    invalidateOrganization(organizationId: string): void;
    private featuresOf;
    private lifecycleOf;
}
