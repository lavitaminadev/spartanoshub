import { Repository } from 'typeorm';
import type { AuthUser } from '../../shared/types/request';
import { Client } from '../../modules/clients/client.entity';
import { PodMember } from '../../modules/pods/pod-member.entity';
import { UserClientAccess } from './user-client-access.entity';
export interface ClientAccessReason {
    clientId: string;
    source: 'pod' | 'assignment' | 'community-manager';
}
export declare class AccountAccessService {
    private readonly clients;
    private readonly podMembers;
    private readonly assignments;
    private static readonly CACHE_TTL_MS;
    private readonly cache;
    constructor(clients: Repository<Client>, podMembers: Repository<PodMember>, assignments: Repository<UserClientAccess>);
    allowedClientIds(organizationId: string, user: AuthUser): Promise<string[] | undefined>;
    assertClient(organizationId: string, user: AuthUser, clientId?: string): Promise<void>;
    explain(organizationId: string, user: AuthUser): Promise<ClientAccessReason[] | 'unrestricted'>;
    invalidateUser(userId: string): void;
    invalidateAll(): void;
    private resolve;
}
