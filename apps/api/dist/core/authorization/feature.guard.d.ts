import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { Organization } from '../../modules/organizations/organization.entity';
export declare class FeatureGuard implements CanActivate {
    private readonly reflector;
    private readonly organizations;
    private static readonly CACHE_TTL_MS;
    private readonly cache;
    constructor(reflector: Reflector, organizations: Repository<Organization>);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private featuresOf;
    invalidate(organizationId: string): void;
}
