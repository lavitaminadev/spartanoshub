import type { UserRole } from '../types/user';

/**
 * Estructura visual y organizacional. No resuelve autorización: los permisos efectivos
 * siguen siendo la única fuente de acceso hasta que exista una migración equivalente.
 */
export const ROLE_TIERS = [
  { id: 'transversal', label: 'Desarrollo transversal', rank: 0 },
  { id: 'organization_direction', label: 'Dirección de organización', rank: 1 },
  { id: 'area_direction', label: 'Dirección de área', rank: 2 },
  { id: 'execution', label: 'Ejecución', rank: 3 },
  { id: 'external', label: 'Externo', rank: 4 },
] as const;

export type RoleTierId = (typeof ROLE_TIERS)[number]['id'];

export const ROLE_TIER: Record<UserRole, RoleTierId> = {
  admin: 'organization_direction',
  dev: 'transversal',
  operations_director: 'organization_direction',
  commercial_director: 'organization_direction',
  creative_director: 'area_direction',
  art_director: 'area_direction',
  av_director: 'area_direction',
  community_manager: 'execution',
  ai_lead: 'execution',
  designer: 'execution',
  audiovisual: 'execution',
  client: 'external',
};
