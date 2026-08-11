/**
 * Claves y acceso al almacenamiento del navegador, en un solo lugar.
 *
 * Todo lo que la aplicación recuerda entre visitas —columnas de una tabla, tarjetas del tablero,
 * el correo del último acceso— cuelga de un mismo espacio de nombres, de modo que se puede
 * listar, migrar o borrar en bloque sin recorrer las pantallas una por una.
 *
 * Las lecturas aceptan además el espacio de nombres anterior y lo trasladan la primera vez que
 * lo encuentran: quien ya tenía preferencias guardadas las conserva sin volver a configurarlas.
 */

/** Prefijo de toda clave escrita por la aplicación. */
export const STORAGE_NAMESPACE = 'espartanos';

/** Prefijo en desuso, aceptado solo para trasladar lo que quedó guardado antes del cambio. */
const LEGACY_NAMESPACE = 'vitahub';

/**
 * Compone una clave del espacio de nombres de la aplicación.
 *
 * @example storageKey('table', 'clients') // 'espartanos:table:clients'
 */
export function storageKey(...segments: string[]): string {
  return [STORAGE_NAMESPACE, ...segments].join(':');
}

/** Equivalente de `key` en el espacio de nombres anterior, o `null` si no le corresponde uno. */
function legacyKeyOf(key: string): string | null {
  return key.startsWith(`${STORAGE_NAMESPACE}:`)
    ? `${LEGACY_NAMESPACE}${key.slice(STORAGE_NAMESPACE.length)}`
    : null;
}

/**
 * Devuelve el valor de `key`, trasladando el de la clave anterior si es el único que existe.
 *
 * El traslado ocurre una sola vez: tras copiarlo, la clave anterior se elimina.
 */
function adopt(store: Storage, key: string): string | null {
  const current = store.getItem(key);
  if (current !== null) return current;

  const legacyKey = legacyKeyOf(key);
  if (!legacyKey) return null;
  const legacy = store.getItem(legacyKey);
  if (legacy === null) return null;

  store.setItem(key, legacy);
  store.removeItem(legacyKey);
  return legacy;
}

/**
 * Resuelve el almacén pedido, o `null` donde no exista.
 *
 * Devuelve `null` en renderizado sin ventana y en los modos de navegación que bloquean el
 * acceso, para que quien llame no tenga que envolver cada uso en un `try`.
 */
function storeOf(kind: 'local' | 'session'): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** Lee un texto guardado. Devuelve `null` si no hay valor o el almacén no está disponible. */
export function readStoredText(key: string, kind: 'local' | 'session' = 'local'): string | null {
  const store = storeOf(kind);
  if (!store) return null;
  try {
    return adopt(store, key);
  } catch {
    return null;
  }
}

/**
 * Guarda un texto. Un `null` borra la clave.
 *
 * Nunca lanza: sin almacenamiento disponible la aplicación sigue funcionando, solo deja de
 * recordar entre visitas.
 */
export function writeStoredText(key: string, value: string | null, kind: 'local' | 'session' = 'local'): void {
  const store = storeOf(kind);
  if (!store) return;
  try {
    if (value === null) store.removeItem(key);
    else store.setItem(key, value);
  } catch {
    // Navegación privada o cuota agotada: la preferencia dura lo que la pestaña.
  }
}

/** Lee un valor JSON guardado, devolviendo `fallback` si falta o está corrupto. */
export function readStoredJson<T>(key: string, fallback: T, kind: 'local' | 'session' = 'local'): T {
  const raw = readStoredText(key, kind);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Guarda un valor serializable como JSON. */
export function writeStoredJson(key: string, value: unknown, kind: 'local' | 'session' = 'local'): void {
  try {
    writeStoredText(key, JSON.stringify(value), kind);
  } catch {
    // Estructura no serializable: se prefiere no recordar antes que romper la interacción.
  }
}
