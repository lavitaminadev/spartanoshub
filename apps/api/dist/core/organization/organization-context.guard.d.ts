import { CanActivate, ExecutionContext } from '@nestjs/common';
export declare class OrganizationContextGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean;
}
