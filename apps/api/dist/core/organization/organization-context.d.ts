import { AsyncLocalStorage } from 'async_hooks';
export interface OrganizationContextStore {
    organizationId?: string;
}
export declare const organizationContext: AsyncLocalStorage<OrganizationContextStore>;
