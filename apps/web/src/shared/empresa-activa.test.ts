import { describe, expect, it } from 'vitest';
import { empresaVigente } from './empresa-activa';

/*
 * Qué empresa vale en cada momento.
 *
 * Lo elegido se guarda en el navegador, pero la lista de las que alcanza viaja al servidor y llega
 * después del primer dibujo. Antes, en ese hueco se usaba la empresa de la sesión y recién al
 * llegar la lista se cambiaba a la guardada: cada pantalla ya había pedido sus datos con la
 * empresa equivocada, y quien dejó abierto su segundo local lo veía abrir en el primero.
 */
describe('empresa vigente de una cuenta de portal', () => {
  it('mientras la lista no llega vale lo elegido la vez anterior', () => {
    expect(empresaVigente({ guardada: 'c-2', suEmpresa: 'c-1', alcanzables: [], listaLista: false })).toBe('c-2');
  });

  it('sin nada elegido antes, la de su cuenta', () => {
    expect(empresaVigente({ guardada: '', suEmpresa: 'c-1', alcanzables: [], listaLista: false })).toBe('c-1');
  });

  it('con la lista ya resuelta, lo elegido se respeta', () => {
    expect(empresaVigente({ guardada: 'c-2', suEmpresa: 'c-1', alcanzables: ['c-1', 'c-2'], listaLista: true })).toBe('c-2');
  });

  it('lo elegido se descarta si esa empresa ya no se alcanza', () => {
    // Le quitaron la asignación, o esa empresa quedó pausada: vuelve a la suya, que no se le quita.
    expect(empresaVigente({ guardada: 'c-9', suEmpresa: 'c-1', alcanzables: ['c-1'], listaLista: true })).toBe('c-1');
  });

  it('una empresa escrita a mano en el navegador no se acepta', () => {
    expect(empresaVigente({ guardada: 'la-de-otro', suEmpresa: 'c-1', alcanzables: ['c-1'], listaLista: true })).toBe('c-1');
  });
});
