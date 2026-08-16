/**
 * @fileoverview Registro de navegación que recolecta manifiestos de features
 * y produce listas de navegación conscientes del rol.
 */

import type { UserRole } from '@espartanos/shared';
import type { ModuleLifecycleStatus } from '@espartanos/shared';
import type { FeatureManifest } from './feature.manifest';
import { isModuleInPhaseScope } from './phase-scope';

/** Features registradas, ordenadas por orden de inserción. */
let features: FeatureManifest[] = [];

/**
 * Secciones del sidebar, en orden de aparición, con las rutas que contiene cada una.
 *
 * El orden reproduce el flujo del prototipo de El Cuartel de los Espartanos
 * (`El_Cuartel_de_los_Espartanos_prototipo_completo`), que va de lo que la agencia
 * captura a lo que entrega: Cliente → Brief → Solicitud → Trabajo → Aprobación → Entrega.
 *
 *   Inicio → Ventas y CRM → Clientes → Reservas → Solicitudes → Trabajos
 *           → Aprobaciones → Contenido → Resultados → Administración
 *
 * Cada rol ve su propio subconjunto: `getNavigationSections` descarta las secciones que
 * quedan vacías para ese rol, y los ítems se ordenan según el orden de estas secciones.
 * No es una lista plana por rol como en el prototipo, pero preserva el mismo flujo para
 * todos y no reparte el menú por dominio (CRM vs Pipeline vs Producción), que fue lo que
 * se reemplazó.
 *
 * Mapeo pantallas del prototipo → ruta existente de la app:
 *   home        → /dashboard                 (Inicio)
 *   sales       → /crm/leads, /crm/opportunities, /crm/interactions, /crm/contacts,
 *                 /catalog, /contracts, /billing                          (Ventas y CRM)
 *   clients     → /clients, /onboarding, /briefs, /meetings, /documents   (Clientes)
 *   reservations→ /reservations(+ agenda/calendar/waitlist/analytics)     (Reservas)
 *   requests    → /intake                                                 (Solicitudes)
 *   production  → /production, /audiovisual, /gamification                (Trabajos)
 *   approvals   → /approvals                                              (Aprobaciones)
 *   content     → /content   — moodboards no tiene ruta propia aún; vive en contenido  (Contenido)
 *   reports     → /reports, /direction, /surveys                          (Resultados)
 *   admin       → /users, /settings, /integrations, /governance,
 *                 /operations, /knowledge, /security                      (Administración)
 *
 * Una ruta sin sección cae en «Más», de modo que registrar una feature nueva nunca la
 * esconde del menú.
 */
export const NAVIGATION_SECTIONS: Array<{ id: string; label: string; paths: string[] }> = [
  { id: 'home', label: 'Inicio', paths: ['/dashboard'] },
  {
    id: 'sales',
    label: 'Ventas y CRM',
    paths: ['/crm/leads', '/crm/opportunities', '/crm/interactions', '/crm/contacts', '/catalog', '/contracts', '/billing'],
  },
  {
    id: 'clients',
    label: 'Clientes',
    paths: ['/clients', '/onboarding', '/briefs', '/meetings', '/documents'],
  },
  {
    id: 'reservations',
    label: 'Reservas',
    paths: ['/reservations', '/reservations/agenda', '/reservations/calendar', '/reservations/waitlist', '/reservations/analytics'],
  },
  {
    id: 'production',
    label: 'Trabajos',
    // El flujo completo del trabajo, en su orden real: se pide, se produce, se aprueba y se
    // publica. Antes cada etapa era su propia sección de un solo ítem, de modo que el menú
    // repetía la palabra dos veces seguidas —«Solicitudes / Solicitudes»— y separaba pasos
    // que pertenecen al mismo recorrido.
    paths: ['/intake', '/production', '/audiovisual', '/approvals', '/content', '/gamification'],
  },
  {
    id: 'results',
    label: 'Medición',
    // Encuestas vive acá y no en su propia sección: lo que se pregunta y lo que se reporta
    // responden la misma pregunta —cómo fue— y se consultan juntos.
    paths: ['/surveys', '/reports', '/direction'],
  },
  {
    id: 'admin',
    label: 'Administración',
    // Panel principal + páginas que usan roles no-admin (operations_director necesita Users, Settings, Governance, Operations).
    // Integraciones, Conocimiento y Seguridad se acceden desde el panel /admin (menos frecuente).
    paths: ['/admin', '/users', '/governance', '/settings', '/operations'],
  },
];

/** Orden preferido del sidebar, derivado de las secciones para no mantener dos listas. */
const NAVIGATION_ORDER: string[] = NAVIGATION_SECTIONS.flatMap((section) => section.paths);

/**
 * Registra un manifiesto de feature.
 *
 * @param feature - Descriptor de la feature a registrar.
 */
export function registerFeature(feature: FeatureManifest): void {
  features.push(feature);
}

/**
 * Devuelve todas las features habilitadas, opcionalmente filtradas por rol.
 *
 * @param _userRole - Rol del usuario actual usado para filtrar.
 * @returns Lista de features filtrada.
 */
export function getFeatures(_userRole?: UserRole): FeatureManifest[] {
  return features.filter((f) => {
    if (f.enabled === false) return false;
    if (!f.permissions?.length && !f.dependencies?.length) return true;
    return true;
  });
}

/**
 * Devuelve las entradas de navegación visibles para el rol dado.
 *
 * @param userRole - Rol del usuario actual.
 * @returns Items de navegación filtrados y ordenados según el orden configurado.
 */
export function getNavigation(
  userRole?: UserRole,
  features?: Record<string, boolean>,
  permissions?: Record<string, string>,
  moduleLifecycle?: Record<string, ModuleLifecycleStatus>,
): FeatureManifest['navigation'] {
  const roleAwareItems = getFeatures(userRole)
    .flatMap((f) => f.navigation)
    .filter((item) => isRoleAllowedForPath(item.roles, userRole))
    .filter((item) => isPathEnabled(item.path, features, permissions, moduleLifecycle, userRole));

  const orderMap = new Map(NAVIGATION_ORDER.map((p, i) => [p, i]));
  return roleAwareItems
    .slice()
    .sort((a, b) => (orderMap.get(a.path) ?? 999) - (orderMap.get(b.path) ?? 999));
}

/** Sección del sidebar ya resuelta, con los items que el usuario actual puede ver. */
export interface NavigationSection {
  id: string;
  label: string;
  items: NonNullable<FeatureManifest['navigation']>;
}

/**
 * Agrupa la navegación visible en secciones, descartando las que quedan vacías.
 *
 * Las rutas sin sección declarada se agrupan al final bajo «Más», para que una feature
 * recién registrada aparezca en el menú aunque nadie la haya asignado todavía.
 *
 * @param userRole - Rol del usuario actual.
 * @param features - Módulos habilitados en la organización.
 * @param permissions - Overrides de permiso por módulo.
 */
export function getNavigationSections(
  userRole?: UserRole,
  features?: Record<string, boolean>,
  permissions?: Record<string, string>,
  moduleLifecycle?: Record<string, ModuleLifecycleStatus>,
): NavigationSection[] {
  const items = getNavigation(userRole, features, permissions, moduleLifecycle) ?? [];
  const byPath = new Map(items.map((item) => [item.path, item]));
  const assigned = new Set<string>();

  const sections = NAVIGATION_SECTIONS.map((section) => {
    const sectionItems = section.paths.flatMap((path) => {
      const item = byPath.get(path);
      if (!item) return [];
      assigned.add(path);
      return [item];
    });
    return { id: section.id, label: section.label, items: sectionItems };
  }).filter((section) => section.items.length > 0);

  const rest = items.filter((item) => !assigned.has(item.path));
  if (rest.length > 0) sections.push({ id: 'more', label: 'Más', items: rest });
  return sections;
}

/**
 * Devuelve la lista blanca de roles explícita para una ruta dada, cuando está
 * declarada en un item de navegación de un manifiesto de feature.
 */
export function getAllowedRolesForPath(path: string): UserRole[] | undefined {
  return getFeatures()
    .flatMap((f) => f.navigation)
    .find((item) => item.path === path)?.roles;
}

/**
 * Reglas de rol compartidas por menú y `ProtectedRoute`.
 *
 * `dev` no se agrega a todas las listas de manifiestos porque esas listas describen el dueño
 * operativo normal de cada pantalla. Desarrollo es una excepción transversal: puede entrar a
 * módulos activos/en desarrollo para diagnosticar, configurar y liberar sin convertir esas
 * pantallas en opciones normales de admin.
 */
export function isRoleAllowedForPath(roles: UserRole[] | undefined, userRole?: UserRole): boolean {
  if (!roles?.length || !userRole) return true;
  if (userRole === 'dev') return true;
  return roles.includes(userRole);
}

/**
 * Módulo de organización al que pertenece cada ruta.
 *
 * La tabla vive acá, en un solo lugar, en vez de repetirse en los veinte manifiestos: es
 * más fácil de auditar y las claves deben coincidir con `ORGANIZATION_FEATURE_KEYS` del
 * backend. Una ruta sin entrada se considera siempre habilitada (login, perfil, 404).
 */
const PATH_FEATURE: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/clients': 'clients',
  '/users': 'users',
  '/settings': 'settings',
  '/integrations': 'integrations',
  '/reservations': 'reservations',
  '/reservations/agenda': 'reservations',
  '/reservations/calendar': 'reservations',
  '/reservations/waitlist': 'reservations',
  '/reservations/analytics': 'reservations',
  // Encuestas propias, distintas de la encuesta post-visita que vive dentro de reservas. El
  // módulo declara su propio estado de producto en `ORGANIZATION_MODULE_CATALOG`, y esta
  // entrada es lo que hace que ese estado gobierne el menú: sin ella la ruta no pertenece a
  // ningún módulo y se muestra siempre, sea cual sea su fase.
  '/surveys': 'surveys',
  '/crm/contacts': 'crm',
  '/crm/leads': 'commercialPipeline',
  '/crm/opportunities': 'commercialPipeline',
  '/crm/interactions': 'commercialPipeline',
  // Las solicitudes se declaran sobre `production`, igual que su controlador en el backend: es
  // la misma operación vista desde antes. Un módulo aparte obligaría a mantener dos listas de
  // permisos que describen lo mismo.
  '/intake': 'intake',
  '/production': 'production',
  '/audiovisual': 'audiovisual',
  '/content': 'content',
  '/documents': 'documents',
  '/briefs': 'briefs',
  '/approvals': 'approvals',
  '/meetings': 'meetings',
  '/reports': 'reports',
  '/billing': 'billing',
  '/contracts': 'contracts',
  '/gamification': 'gamification',
  '/catalog': 'catalog',
  '/knowledge': 'knowledge',
  '/onboarding': 'onboarding',
  '/direction': 'direction',
  '/operations': 'operations',
  '/governance': 'governance',
};

/** Módulo requerido por una ruta, o `undefined` si la ruta no depende de ninguno. */
export function getFeatureForPath(path: string): string | undefined {
  return PATH_FEATURE[path];
}

/**
 * Indica si una ruta está disponible para el usuario.
 *
 * Prioriza los permisos efectivos que resuelve el backend, que ya combinan módulo
 * habilitado, cargo y excepciones por persona. Si no están disponibles, recurre a los
 * módulos habilitados de la organización.
 *
 * Mientras no se conoce ninguno de los dos —la sesión aún carga— responde `true` para no
 * ocultar el menú completo durante un instante en cada recarga.
 *
 * @param path - Ruta declarada en un manifiesto de feature.
 * @param features - Módulos habilitados en la organización.
 * @param permissions - Nivel efectivo por módulo del usuario autenticado.
 */
export function isPathEnabled(
  path: string,
  features?: Record<string, boolean>,
  permissions?: Record<string, string>,
  moduleLifecycle?: Record<string, ModuleLifecycleStatus>,
  userRole?: string,
): boolean {
  const required = getFeatureForPath(path);
  // El alcance de fase se evalúa antes que permisos y capacidades: un módulo que el producto
  // todavía no ofrece no debe aparecer para nadie, por más permisos que tenga el usuario.
  // La excepción es el cargo de desarrollo, único por organización, que es quien los levanta.
  if (!isModuleInPhaseScope(required, moduleLifecycle, userRole)) return false;
  if (!required) return true;
  if (permissions) return permissions[required] !== undefined && permissions[required] !== 'none';
  if (features) return features[required] !== false;
  return true;
}

/**
 * Devuelve todas las rutas registradas por las features habilitadas.
 */
export function getAllRoutes(): FeatureManifest['routes'] {
  return getFeatures().flatMap((f) => f.routes);
}
