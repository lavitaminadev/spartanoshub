import type { OrganizationFeatureKey } from '../../modules/organizations/organization-features';
export declare const MODULE_SCOPE_KEY = "moduleScope";
export declare const MODULE_EXEMPT_KEY = "moduleExempt";
export declare const ModuleScope: (module: OrganizationFeatureKey) => import("@nestjs/common").CustomDecorator<string>;
export declare const ModuleExempt: (reason: string) => import("@nestjs/common").CustomDecorator<string>;
