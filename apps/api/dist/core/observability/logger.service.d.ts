import { ConsoleLogger } from '@nestjs/common';
export declare class LoggerService extends ConsoleLogger {
    private requestId?;
    private userId?;
    private organizationId?;
    setRequestId(requestId: string): void;
    setUserId(userId: string): void;
    setOrganizationId(organizationId: string): void;
    private buildLogEntry;
    log(message: any, context?: string): void;
    info(message: any, context?: string): void;
    warn(message: any, context?: string): void;
    error(message: any, trace?: string, context?: string): void;
    debug(message: any, context?: string): void;
}
