import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Lo guardado en el equipo es de quien lo generó.
 *
 * La caché de consultas se escribe en el navegador para que la aplicación abra con datos en
 * pantalla en vez de en blanco. Se vaciaba al cerrar sesión —correcto— pero **nadie cierra
 * sesión**: se cierra el navegador. Lo guardado quedaba en el equipo sin dueño anotado, y la
 * siguiente persona que entrara veía los datos de la anterior hasta que cada consulta se
 * revalidara sola.
 *
 * En un computador compartido de la agencia eso es ver la cartera, los montos y los contactos de
 * otra persona. Con un cliente entrando desde el mismo equipo, los de otra empresa.
 */
const almacen = new Map<string, unknown>();

vi.mock('./offline-store', () => ({
  readOffline: vi.fn(async (key: string) => almacen.get(key)),
  writeOffline: vi.fn(async (key: string, valor: unknown) => { almacen.set(key, valor); }),
  removeOffline: vi.fn(async (key: string) => { almacen.delete(key); }),
}));

const { claimQueryCache, clearQueryCache } = await import('./query-persistence');

describe('dueño de la caché guardada', () => {
  beforeEach(() => {
    almacen.clear();
  });

  it('la primera vez la reclama sin borrar nada: no hay nada de nadie', async () => {
    almacen.set('query-cache', [{ key: ['leads'], data: [1, 2, 3], updatedAt: Date.now() }]);

    await claimQueryCache('ana');

    expect(almacen.get('query-cache-owner')).toBe('ana');
  });

  it('si vuelve la misma persona, su caché se conserva', async () => {
    almacen.set('query-cache-owner', 'ana');
    almacen.set('query-cache', [{ key: ['leads'], data: [1, 2, 3], updatedAt: Date.now() }]);

    await claimQueryCache('ana');

    // Abrir con datos en pantalla en vez de en blanco es justamente para lo que existe.
    expect(almacen.get('query-cache')).toBeDefined();
  });

  it('si entra otra persona, lo guardado se borra antes de que llegue a verse', async () => {
    almacen.set('query-cache-owner', 'ana');
    almacen.set('query-cache', [{ key: ['leads'], data: ['contactos de Ana'], updatedAt: Date.now() }]);

    await claimQueryCache('beto');

    expect(almacen.get('query-cache')).toBeUndefined();
    expect(almacen.get('query-cache-owner')).toBe('beto');
  });

  it('sin dueño anotado —lo guardado por una versión anterior— se descarta', async () => {
    // Es el caso de quien ya tenía caché escrita antes de que existiera el dueño: no se sabe de
    // quién es, así que no se puede mostrar.
    almacen.set('query-cache', [{ key: ['leads'], data: ['de alguien'], updatedAt: Date.now() }]);

    await claimQueryCache('ana');

    expect(almacen.get('query-cache')).toBeUndefined();
  });

  it('cerrar sesión borra el contenido y también el dueño', async () => {
    almacen.set('query-cache-owner', 'ana');
    almacen.set('query-cache', [{ key: ['leads'], data: [1], updatedAt: Date.now() }]);

    await clearQueryCache();

    expect(almacen.get('query-cache')).toBeUndefined();
    // Dejar el dueño haría que la siguiente sesión de Ana creyera tener caché válida y vacía.
    expect(almacen.get('query-cache-owner')).toBeUndefined();
  });
});
