/**
 * El único sitio donde se resuelve la empresa de una petición.
 *
 * Lo que estas pruebas defienden son las dos decisiones de montaje que hacen que sirva, y que son
 * fáciles de deshacer sin darse cuenta:
 *
 *   1. La empresa se lee de la ruta antes que de la consulta. `PUT users/:id/administra/:clientId`
 *      dice en la propia dirección sobre qué empresa actúa; leer primero la consulta hacía que
 *      quien administra un segundo local se midiera contra el primero.
 *   2. Un fallo al resolver no se lanza aquí. El interceptor corre en todas las rutas y muchas no
 *      necesitan empresa: lanzar un 400 porque la petición no la declaró las rompería todas.
 *      Se guarda, y lo lanza `@Empresa()`, que es quien sabe que hacía falta.
 */

import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import { AGENCIA } from '../../../src/core/client-scope/empresa-resuelta';
import { ambitoDeLaPeticion, EmpresaInterceptor } from '../../../src/core/client-scope/empresa.interceptor';

const PORTAL = { id: 'u1', role: 'client', clientId: 'mia', organizationId: 'org-1' };

function correr(peticion: Record<string, unknown>, alcanzables: string[] | undefined) {
  const accesos = {
    allowedClientIds: vi.fn().mockResolvedValue(alcanzables),
    assertClient: vi.fn(async (_org: string, _user: unknown, clientId: string) => {
      if (alcanzables !== undefined && !alcanzables.includes(clientId)) throw new Error('Client not found');
    }),
  };
  const contexto = { switchToHttp: () => ({ getRequest: () => peticion }) } as never;
  const siguiente = { handle: vi.fn(() => of('ok')) };
  return new EmpresaInterceptor(accesos as never).intercept(contexto, siguiente as never).then(() => peticion);
}

describe('resolver la empresa en la petición', () => {
  it('deja la empresa resuelta donde el decorador la lee', async () => {
    const peticion = await correr({ user: PORTAL, organizationId: 'org-1', query: { clientId: 'otra' } }, ['mia', 'otra']);

    expect(ambitoDeLaPeticion(peticion)).toBe('otra');
  });

  /* La ruta manda: es la forma más explícita de decir sobre qué empresa va la petición. */
  it('la empresa de la ruta pesa más que la de la consulta', async () => {
    const peticion = await correr(
      { user: PORTAL, organizationId: 'org-1', params: { clientId: 'otra' }, query: { clientId: 'mia' } },
      ['mia', 'otra'],
    );

    expect(ambitoDeLaPeticion(peticion)).toBe('otra');
  });

  it('sin declararla y con una sola empresa, esa', async () => {
    const peticion = await correr({ user: PORTAL, organizationId: 'org-1' }, ['mia']);

    expect(ambitoDeLaPeticion(peticion)).toBe('mia');
  });

  it('un cargo sin límite que no declara empresa resuelve a la agencia', async () => {
    const direccion = { id: 'u2', role: 'admin', organizationId: 'org-1' };
    const peticion = await correr({ user: direccion, organizationId: 'org-1' }, undefined);

    expect(ambitoDeLaPeticion(peticion)).toBe(AGENCIA);
  });

  /*
   * El punto 2. El interceptor no puede decidir si esta ruta necesitaba una empresa, así que
   * guarda el error en vez de lanzarlo: lanzarlo aquí rompería las rutas que no la necesitan.
   */
  it('guarda el fallo en vez de lanzarlo, y la petición sigue su curso', async () => {
    const peticion = await correr({ user: PORTAL, organizationId: 'org-1', query: { clientId: 'ajena' } }, ['mia']);

    expect(ambitoDeLaPeticion(peticion)).toBeInstanceOf(Error);
  });

  it('una petición sin sesión no resuelve nada, en vez de inventar un ámbito', async () => {
    const peticion = await correr({ query: { clientId: 'mia' } }, ['mia']);

    expect(ambitoDeLaPeticion(peticion)).toBeUndefined();
  });
});
