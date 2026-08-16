import type { UserRole } from '../types/user';
/**
 * Estructura visual y organizacional. No resuelve autorización: los permisos efectivos
 * siguen siendo la única fuente de acceso hasta que exista una migración equivalente.
 */
export declare const ROLE_TIERS: readonly [{
    readonly id: "transversal";
    readonly label: "Desarrollo transversal";
    readonly rank: 0;
}, {
    readonly id: "organization_direction";
    readonly label: "Dirección de organización";
    readonly rank: 1;
}, {
    readonly id: "area_direction";
    readonly label: "Dirección de área";
    readonly rank: 2;
}, {
    readonly id: "execution";
    readonly label: "Ejecución";
    readonly rank: 3;
}, {
    readonly id: "external";
    readonly label: "Externo";
    readonly rank: 4;
}];
export type RoleTierId = (typeof ROLE_TIERS)[number]['id'];
export declare const ROLE_TIER: Record<UserRole, RoleTierId>;
//# sourceMappingURL=role-tiers.d.ts.map