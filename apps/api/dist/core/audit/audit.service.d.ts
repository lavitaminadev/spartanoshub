import { Repository } from 'typeorm';
import { AuditLog } from './audit.entity';
export declare class AuditService {
    private repo;
    constructor(repo: Repository<AuditLog>);
    log(params: {
        organizationId: string;
        actorId?: string;
        entityType: string;
        entityId?: string | null;
        action: string;
        before?: any;
        after?: any;
        reason?: string;
        ipAddress?: string;
    }): Promise<AuditLog>;
    findByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
    search(organizationId: string, options: {
        entityType?: string;
        entityId?: string;
        action?: string;
        actorId?: string;
        limit?: number;
    }): Promise<any[]>;
    findByOrganization(organizationId: string, limit?: number): Promise<AuditLog[]>;
}
