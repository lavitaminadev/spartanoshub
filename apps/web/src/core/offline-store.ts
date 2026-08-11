/**
 * Almacén local en IndexedDB, para lo que no cabe en `localStorage`.
 *
 * `localStorage` guarda texto, es síncrono —bloquea el hilo de la interfaz— y ronda los 5 MB.
 * Sirve para preferencias (ver [browser-storage.ts]) y no para el resultado de una consulta.
 * Este módulo cubre ese otro caso: volúmenes mayores, escritura asíncrona y valores
 * estructurados que no hay que serializar a mano.
 *
 * Todo lo guardado es de la persona que tiene la sesión abierta, así que `clearOfflineStore()`
 * se llama al cerrar sesión: sin eso, los datos de una cuenta quedarían legibles en el
 * dispositivo para quien entre después.
 *
 * Se implementa sobre la API del navegador y sin dependencias: el despliegue vive en un cPanel
 * con límite de inodos, donde cada paquete nuevo tiene un costo que este archivo no justifica.
 */

const DATABASE_NAME = 'espartanos';
const DATABASE_VERSION = 1;
const STORE_NAME = 'cache';

/** Entrada guardada, con el momento de escritura para poder descartarla por antigüedad. */
interface StoredEntry<T> {
  value: T;
  savedAt: number;
}

/**
 * Conexión abierta, reutilizada entre llamadas.
 *
 * `null` significa que este navegador no ofrece IndexedDB o que la apertura falló, caso en el
 * que todas las operaciones se vuelven inocuas en vez de propagar el error: el almacén es una
 * mejora, y la aplicación tiene que seguir funcionando sin él.
 */
let connection: Promise<IDBDatabase | null> | null = null;

function openDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Navegación privada de algunos navegadores deja la apertura colgada en vez de fallar.
    request.onblocked = () => resolve(null);
  });
}

function database(): Promise<IDBDatabase | null> {
  connection ??= openDatabase();
  return connection;
}

/** Ejecuta una operación sobre el almacén, devolviendo `fallback` si no está disponible. */
async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest,
  fallback: T,
): Promise<T> {
  const db = await database();
  if (!db) return fallback;

  return new Promise<T>((resolve) => {
    let request: IDBRequest;
    try {
      request = operation(db.transaction(STORE_NAME, mode).objectStore(STORE_NAME));
    } catch {
      resolve(fallback);
      return;
    }
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => resolve(fallback);
  });
}

/**
 * Lee un valor guardado.
 *
 * @param key - Clave con la que se guardó.
 * @param maxAgeMs - Antigüedad máxima aceptable. Una entrada más vieja se trata como ausente.
 * @returns El valor, o `undefined` si no existe, venció o el almacén no está disponible.
 */
export async function readOffline<T>(key: string, maxAgeMs?: number): Promise<T | undefined> {
  const entry = await withStore<StoredEntry<T> | undefined>(
    'readonly',
    (store) => store.get(key),
    undefined,
  );
  if (!entry) return undefined;
  if (maxAgeMs !== undefined && Date.now() - entry.savedAt > maxAgeMs) return undefined;
  return entry.value;
}

/**
 * Guarda un valor, reemplazando el anterior de la misma clave.
 *
 * El valor tiene que ser clonable por el navegador: no admite funciones ni clases. Si no lo es,
 * la escritura se descarta en silencio en vez de interrumpir a quien la pidió.
 */
export async function writeOffline<T>(key: string, value: T): Promise<void> {
  const entry: StoredEntry<T> = { value, savedAt: Date.now() };
  await withStore<unknown>('readwrite', (store) => store.put(entry, key), undefined);
}

/** Elimina una clave. No falla si no existía. */
export async function removeOffline(key: string): Promise<void> {
  await withStore<unknown>('readwrite', (store) => store.delete(key), undefined);
}

/**
 * Vacía el almacén completo.
 *
 * Se invoca al cerrar sesión: lo guardado pertenece a la cuenta que lo generó y no debe
 * sobrevivirla en un dispositivo compartido.
 */
export async function clearOfflineStore(): Promise<void> {
  await withStore<unknown>('readwrite', (store) => store.clear(), undefined);
}
