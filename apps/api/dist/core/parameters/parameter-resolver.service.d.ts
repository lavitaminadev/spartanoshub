import { Repository } from 'typeorm';
import { ParameterDefinition } from './parameter-definition.entity';
import { ParameterValue } from './parameter-value.entity';
export declare class ParameterResolver {
    private definitionRepo;
    private valueRepo;
    private cache;
    private readonly ttlMs;
    constructor(definitionRepo: Repository<ParameterDefinition>, valueRepo: Repository<ParameterValue>);
    get(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): Promise<any>;
    getFresh(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): Promise<any>;
    invalidate(key: string, clientId?: string | null, planId?: string | null, organizationId?: string | null): void;
    private cacheKey;
    private resolveFromDb;
    private findActiveValue;
}
