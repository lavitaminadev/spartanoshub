import { PermissionLevel } from './permission-level';
export declare class UserPermissionOverride {
    id: string;
    organizationId: string;
    userId: string;
    module: string;
    level: PermissionLevel;
    reason?: string | null;
    grantedBy?: string | null;
    createdAt: Date;
    updatedAt: Date;
}
