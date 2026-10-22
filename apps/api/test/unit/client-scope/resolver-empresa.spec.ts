/**
 * Cómo se decide sobre qué empresa va una petición.
 *
 * Hoy esa frase está escrita dieciséis veces, y las dieciséis acaban igual: «la pedida si la
 * alcanza, si no la mía». Ese «si no la mía» es el defecto. Con una sola empresa por cuenta
 * acertaba siempre —de ahí que ninguna prueba haya fallado nunca—; con dos, pedir la B y recibir
 * la A escribe en la empresa equivocada y responde 200, sin nada que lo delate.
 *
 * Lo que estas pruebas fijan es que no haya repliegue. Quien pide una empresa que no alcanza
 * recibe un 404 —el mismo que si no existiera, porque decir «existe pero no es tuya» ya revela a
 * quién atiende la agencia—, y quien no pide ninguna teniendo varias recibe una pregunta, no un
 * resultado sobre una empresa que nunca eligió.
 */

import { describe, expect, it, vi } from 'vitest';
import { AGENCIA, esUnaEmpresa, resolverEmpresa } from '../../../src/core/client-scope/empresa-resuelta';

const PORTAL = { id: 'u1', role: 'client', clientId: 'mia', organizationId: 'org-1' } as never;
const DIRECCION = { id: 'u2', role: 'admin', organizationId: 'org-1' } as never;

/** @param alcanzables - `undefined` es sin límite; una lista vacía es ninguna empresa. */
function alcance(alcanzables: string[] | undefined) {
  return {
    alcanzables,
    comprobar: vi.fn(async (clientId: string) => {
      if (alcanzables !== undefined && !alcanzables.includes(clientId)) {
        throw Object.assign(new Error('Client not found'), { status: 404 });
      }
    }),
  };
}

describe('resolver la empresa de la petición', () => {
  it('la empresa declarada, cuando la cuenta la alcanza', async () => {
    const resuelta = await resolverEmpresa('otra', PORTAL, alcance(['mia', 'otra']));
    expect(resuelta).toBe('otra');
  });

  /*
   * El caso que justifica todo. Antes devolvía «mia» y la escritura entraba en la empresa
   * equivocada con un 200 encima.
   */
  it('una empresa que no alcanza da 404, y no se cambia por la suya', async () => {
    await expect(resolverEmpresa('ajena', PORTAL, alcance(['mia']))).rejects.toThrow(/not found/i);
  });

  it('sin declarar nada y con una sola empresa, esa', async () => {
    expect(await resolverEmpresa(undefined, PORTAL, alcance(['mia']))).toBe('mia');
  });

  /*
   * Elegir por el usuario es lo mismo que adivinar: la petición acabaría sobre una empresa que
   * nadie nombró, y el 200 haría pensar que sí.
   */
  it('sin declarar nada y con varias, pregunta en vez de elegir', async () => {
    await expect(resolverEmpresa(null, PORTAL, alcance(['mia', 'otra']))).rejects.toThrow(/Elige la empresa/);
  });

  it('sin límite y sin declarar nada, la petición es de la agencia', async () => {
    const resuelta = await resolverEmpresa(undefined, DIRECCION, alcance(undefined));
    expect(resuelta).toBe(AGENCIA);
    expect(esUnaEmpresa(resuelta)).toBe(false);
  });

  it('sin límite, una empresa declarada sigue siendo la empresa', async () => {
    const resuelta = await resolverEmpresa('cualquiera', DIRECCION, alcance(undefined));
    expect(resuelta).toBe('cualquiera');
    expect(esUnaEmpresa(resuelta)).toBe(true);
  });

  /*
   * Sin esto, una cuenta a la que se le quitó todo el alcance caería en el camino de «sin
   * límite» y pasaría a ver la agencia entera: el alcance vacío convertido en acceso total.
   */
  it('una cuenta sin ninguna empresa lo dice, en vez de pasar por la agencia', async () => {
    const huerfano = { id: 'u3', role: 'client', organizationId: 'org-1' } as never;
    await expect(resolverEmpresa(undefined, huerfano, alcance([]))).rejects.toThrow(/ninguna empresa asignada/);
  });

  it('la empresa de la propia cuenta cuenta como suya aunque la lista llegue vacía', async () => {
    // Es la que no se le puede quitar: su cuenta de portal es de esa empresa.
    expect(await resolverEmpresa(undefined, PORTAL, alcance([]))).toBe('mia');
  });

  it('los espacios alrededor no cambian la empresa ni la vuelven «sin declarar»', async () => {
    expect(await resolverEmpresa('  otra  ', PORTAL, alcance(['mia', 'otra']))).toBe('otra');
    expect(await resolverEmpresa('   ', PORTAL, alcance(['mia']))).toBe('mia');
  });
});
