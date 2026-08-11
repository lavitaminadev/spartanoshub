import type { Request } from 'express';
import type { UserRole } from '@vitahub/shared';
export interface AuthUser {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    organizationId: string;
    clientId?: string;
    sessionId?: string;
    tenantId: string;
}
export interface AuthenticatedRequest extends Request {
    user: AuthUser;
    organizationId: string;
}
