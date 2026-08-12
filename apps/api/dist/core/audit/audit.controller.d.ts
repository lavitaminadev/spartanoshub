import type { AuthenticatedRequest } from '../../shared/types/request';
import { AuditService } from './audit.service';
export declare class AuditController {
    private readonly audit;
    constructor(audit: AuditService);
    list(req: AuthenticatedRequest, entityType?: string, entityId?: string, action?: string, actorId?: string, limit?: string): Promise<any[]>;
}
