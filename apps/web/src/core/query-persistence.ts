/**
 * Conserva el resultado de las consultas entre visitas, sobre [offline-store.ts].
 *
 * Sin esto, recargar la aplicación con la red caída deja pantallas de error: la caché de
 * TanStack Query vive en memoria y se pierde al cerrar la pestaña. Con esto, la aplicación
 * arranca mostrando lo último que se supo —marcado como desactualizado— y lo reemplaza en
 * cuanto la primera petición responde.
 *
 * Qué se guarda y qué no:
 *
 * - Solo consultas resueltas con éxito. Un error o una carga a medias no aporta nada al
 *   arrancar y ocultaría el estado real.
 * - Nada relacionado con sesión ni permisos: son decisiones de acceso que deben tomarse
 *   contra el servidor en cada arranque, nunca contra una copia local.
 * - Se descarta lo guardado hace más de un día, para no abrir con cifras de la semana pasada.
 *
 * El contenido pertenece a la cuenta que lo generó, así que se borra al cerrar sesión.
 */

import type { QueryClient } from '@tanstack/react-query';
import { readOffline, writeOffline } from './offline-store';

/** Clave del almacén donde vive la copia de la caché. */
const CACHE_KEY = 'query-cache';

/** Antigüedad a partir de la cual la copia deja de usarse. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Tope de consultas guardadas, de la más reciente a la más antigua. */
const MAX_ENTRIES = 120;

/** Espera tras el último cambio antes de escribir, para no guardar en cada tecla. */
const WRITE_DELAY_MS = 1_500;

/**
 * Fragmentos de clave que nunca se guardan.
 *
 * Son respuestas que deciden qué puede hacer alguien o dónde tiene la sesión abierta:
 * responderlas desde una copia local, aunque sea por un instante, mostraría permisos que el
 * servidor ya pudo haber revocado.
 */
const EXCLUDED_KEY_PARTS = ['session', 'sessions', 'permissions', 'me'];

interface PersistedQuery {
  key: unknown[];
  data: unknown;
  updatedAt: number;
}

/** Indica si una consulta puede guardarse en el dispositivo. */
export function isPersistableQueryKey(key: unknown[]): boolean {
  return !key.some((part) => typeof part === 'string' && EXCLUDED_KEY_PARTS.includes(part));
}

/** Copia las consultas exitosas de la caché en memoria. */
function snapshot(queryClient: QueryClient): PersistedQuery[] {
  return queryClient.getQueryCache().getAll()
    .filter((query) => query.state.status === 'success' && query.state.data !== undefined)
    .filter((query) => isPersistableQueryKey(query.queryKey as unknown[]))
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)
    .slice(0, MAX_ENTRIES)
    .map((query) => ({
      key: query.queryKey as unknown[],
      data: query.state.data,
      updatedAt: query.state.dataUpdatedAt,
    }));
}

/**
 * Vuelca en la caché lo guardado en la visita anterior.
 *
 * Se llama antes del primer render. Los datos entran con su fecha original, de modo que
 * TanStack Query los considera desactualizados y dispara la revalidación por su cuenta.
 */
export async function restoreQueryCache(queryClient: QueryClient): Promise<void> {
  const stored = await readOffline<PersistedQuery[]>(CACHE_KEY, MAX_AGE_MS);
  if (!Array.isArray(stored)) return;

  for (const entry of stored) {
    if (!Array.isArray(entry?.key)) continue;
    queryClient.setQueryData(entry.key, entry.data, { updatedAt: entry.updatedAt });
  }
}

/**
 * Empieza a guardar la caché cada vez que cambia.
 *
 * @returns Función que detiene el guardado y cancela la escritura pendiente.
 */
export function persistQueryCache(queryClient: QueryClient): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(() => { void writeOffline(CACHE_KEY, snapshot(queryClient)); }, WRITE_DELAY_MS);
  });

  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
