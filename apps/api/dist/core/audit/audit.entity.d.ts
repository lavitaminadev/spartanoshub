export declare class AuditLog {
    id: string;
    organizationId: string;
    actorId?: string | null;
    entityType: string;
    entityId?: string | null;
    action: string;
    before?: any;
    after?: any;
    reason?: string;
    ipAddress?: string;
    occurredAt: Date;
}
