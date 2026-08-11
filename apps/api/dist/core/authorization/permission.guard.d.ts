import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionResolverService } from './permission-resolver.service';
export declare class PermissionGuard implements CanActivate {
    private readonly reflector;
    private readonly permissions;
    private readonly logger;
    constructor(reflector: Reflector, permissions: PermissionResolverService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private resolveRequirement;
}
