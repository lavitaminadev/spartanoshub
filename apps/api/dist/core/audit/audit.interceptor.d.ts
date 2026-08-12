import { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuditService } from './audit.service';
export declare class AuditInterceptor implements NestInterceptor {
    private readonly audit;
    private readonly logger;
    constructor(audit: AuditService);
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown>;
    private entityType;
    private action;
    private sanitize;
}
