import type { UserRole } from '@espartanos/shared';

/**
 * Lente de área: ver la aplicación como la ve otra área, sin dejar de ser uno mismo.
 *
 * El problema que resuelve es concreto: para revisar cómo le queda la vista a un diseñador hacía
 * falta una cuenta de diseñador, y mantener cuentas paralelas para eso termina con credenciales
 * repartidas y con nadie seguro de cuál es la real.
 *
 * **La lente no toca los permisos.** Cambia qué se arma en pantalla —navegación, columnas del
 * tablero, filtros por defecto— y nada más. Quien la usa sigue pudiendo todo lo que su cargo le
 * permite, y cada acción queda registrada con su nombre.
 *
 * Esa es la diferencia con suplantar, y es deliberada: si la lente recortara permisos, la
 * bitácora mostraría a un diseñador haciendo cosas que en realidad hizo el desarrollador, y el
 * registro dejaría de servir para lo único que sirve, que es saber quién hizo qué.
 *
 * Para depurar «por qué esta persona no ve esto», la lente alcanza: lo que se ve depende del
 * alcance de datos del área, que es justamente lo que reproduce.
 */

/** Áreas que se pueden mirar, más la vista propia. */
export type AreaLens = 'own' | 'design' | 'audiovisual' | 'community' | 'commercial' | 'admin';

export const AREA_LENS_LABELS: Record<AreaLens, string> = {
  own: 'Mi vista',
  design: 'Arte',
  audiovisual: 'Audiovisual',
  community: 'Community',
  commercial: 'Comercial',
  admin: 'Administración',
};

/**
 * Cargos que pueden usar la lente.
 *
 * Desarrollo la necesita para revisar vistas. Administración, para entender lo que reporta
 * alguien del equipo sin pedirle su contraseña. Nadie más: para el resto no resuelve un problema
 * y solo agregaría una perilla que confunde.
 */
const LENS_ROLES = new Set<string>(['dev', 'admin']);

export function canUseAreaLens(role?: string): boolean {
  return Boolean(role && LENS_ROLES.has(role));
}

/**
 * Área con la que armar la pantalla.
 *
 * Devuelve el área natural del cargo salvo que haya una lente puesta. Un cargo sin área propia
 * —dirección transversal, administración— no queda limitado a ninguna: devuelve `undefined`, que
 * las vistas leen como «todas».
 */
const NATURAL_AREA: Partial<Record<string, AreaLens>> = {
  designer: 'design',
  art_director: 'design',
  audiovisual: 'audiovisual',
  av_director: 'audiovisual',
  community_manager: 'community',
  commercial_director: 'commercial',
};

export function effectiveArea(role: UserRole | string | undefined, lens: AreaLens = 'own'): AreaLens | undefined {
  if (lens !== 'own' && canUseAreaLens(role)) return lens;
  return role ? NATURAL_AREA[role] : undefined;
}

/**
 * Espacio de trabajo con el que abrir la sesión.
 *
 * Alguien que es Director Comercial y además administrador entra hoy a una pantalla que mezcla
 * su operación diaria con lo administrativo, y eso hace difícil encontrar lo propio. Con esto
 * abre en lo suyo y lo administrativo queda a un clic, sin perder ninguna atribución.
 */
export function defaultWorkspace(role: UserRole | string | undefined): AreaLens {
  if (!role) return 'own';
  // Desarrollo abre en la vista completa: revisar el conjunto es su trabajo.
  if (role === 'dev') return 'admin';
  return NATURAL_AREA[role] ?? 'admin';
}

/** Clave donde se recuerda la lente puesta. Es preferencia de la persona, no de la organización. */
export const AREA_LENS_STORAGE_KEY = 'espartanos.area-lens';
