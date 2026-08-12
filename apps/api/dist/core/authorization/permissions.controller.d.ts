import { Repository } from 'typeorm';
import { PermissionResolverService } from './permission-resolver.service';
import { UserPermissionOverride } from './user-permission-override.entity';
import { UpsertPermissionOverrideDto } from './dto/upsert-permission-override.dto';
import { UserRole } from '../../modules/organizations/user-role.enum';
import { User } from '../../modules/users/user.entity';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { AccountAccessService } from '../client-scope/account-access.service';
import { UserClientAccess } from '../client-scope/user-client-access.entity';
import { GrantClientAccessDto } from './dto/grant-client-access.dto';
import { Client } from '../../modules/clients/client.entity';
export declare class PermissionsController {
    private readonly permissions;
    private readonly overrides;
    private readonly users;
    private readonly clientAccess;
    private readonly clients;
    private readonly accountAccess;
    private readonly audit;
    constructor(permissions: PermissionResolverService, overrides: Repository<UserPermissionOverride>, users: Repository<User>, clientAccess: Repository<UserClientAccess>, clients: Repository<Client>, accountAccess: AccountAccessService, audit: AuditService);
    mine(req: AuthenticatedRequest): Promise<{
        permissions: import("./permission-resolver.service").PermissionMap;
    }>;
    ofRole(role: string, req: AuthenticatedRequest): Promise<{
        role: string;
        permissions: {
            [k: string]: "none" | "view" | "edit" | "manage";
        };
    }>;
    ofUser(id: string, req: AuthenticatedRequest): Promise<{
        userId: string;
        role: UserRole;
        modules: import("./permission-resolver.service").EffectivePermission[];
    }>;
    upsert(id: string, module: string, dto: UpsertPermissionOverrideDto, req: AuthenticatedRequest): Promise<{
        organizationId: string;
        userId: string;
        module: "audiovisual" | "dashboard" | "clients" | "users" | "reservations" | "crm" | "integrations" | "settings" | "clientMetricsPanel" | "multiClientOnboarding" | "production" | "udBudget" | "gamification" | "billing" | "contracts" | "catalog" | "content" | "briefs" | "meetings" | "documents" | "approvals" | "knowledge" | "reports" | "onboarding" | "operations" | "governance" | "direction" | "commercialPipeline";
        level: "none" | "view" | "edit" | "manage";
        reason: string | null;
        grantedBy: string;
        id?: string | undefined;
        createdAt?: Date | undefined;
        updatedAt?: Date | undefined;
    } & UserPermissionOverride>;
    remove(id: string, module: string, req: AuthenticatedRequest): Promise<{
        removed: boolean;
        module: string;
    }>;
    clientAccessOfUser(id: string, req: AuthenticatedRequest): Promise<{
        userId: string;
        role: UserRole;
        access: import("../client-scope/account-access.service").ClientAccessReason[] | "unrestricted";
    }>;
    grantClientAccess(id: string, clientId: string, dto: GrantClientAccessDto, req: AuthenticatedRequest): Promise<{
        organizationId: string;
        userId: string;
        clientId: string;
        reason: string | null;
        grantedBy: string;
        id?: string | undefined;
        createdAt?: Date | undefined;
    } & UserClientAccess>;
    revokeClientAccess(id: string, clientId: string, req: AuthenticatedRequest): Promise<{
        removed: boolean;
        clientId: string;
        stillVisible: boolean;
    }>;
    private findUser;
}
