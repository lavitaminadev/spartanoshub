import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionsService } from './sessions.service';
export declare class RecentAuthGuard implements CanActivate {
    private readonly reflector;
    private readonly sessions;
    constructor(reflector: Reflector, sessions: SessionsService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
