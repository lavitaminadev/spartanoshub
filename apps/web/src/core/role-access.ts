import type { UserRole } from '@espartanos/shared';

/**
 * Desarrollo es el cargo transversal del producto. Las listas de cada pantalla
 * describen al responsable operativo normal; no deben dejar a Desarrollo sin
 * el control que el backend ya autoriza para diagnóstico y soporte.
 */
export function hasRoleAccess(role: UserRole | string | undefined, allowedRoles: readonly string[]): boolean {
  return role === 'dev' || (typeof role === 'string' && allowedRoles.includes(role as UserRole));
}
