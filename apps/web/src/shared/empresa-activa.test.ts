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

  it('con varias empresas y ninguna elegida no se cae a la de la sesión', () => {
    expect(empresaVigente({ guardada: '', suEmpresa: 'c-1', alcanzables: ['c-1', 'c-2'], listaLista: true })).toBe('');
    expect(empresaVigente({ guardada: 'c-9', suEmpresa: 'c-1', alcanzables: ['c-1', 'c-2'], listaLista: true })).toBe('');
  });

  it('una empresa escrita a mano en el navegador no se acepta', () => {
    expect(empresaVigente({ guardada: 'la-de-otro', suEmpresa: 'c-1', alcanzables: ['c-1'], listaLista: true })).toBe('c-1');
  });
});

/*
 * La misma regla para el equipo interno, con una diferencia declarada.
 *
 * Para una cuenta de portal «ninguna empresa» es un estado a resolver: atiende varias y todavía no
 * eligió, así que ninguna pantalla debe operar. Para el equipo interno es una vista de verdad —su
 * cartera entera— y la de por omisión, porque comparar cuentas es parte de su trabajo. Sin esa
 * diferencia, una community manager con tres cuentas quedaba encerrada en la primera o eligiendo
 * empresa en cada pantalla por separado.
 */
describe('empresa vigente del equipo interno', () => {
  it('sin nada elegido, todas las que alcanza', () => {
    expect(empresaVigente({ guardada: '', suEmpresa: '', alcanzables: ['c-1', 'c-2', 'c-3'], listaLista: true, admiteTodas: true })).toBe('');
  });

  it('lo elegido se respeta igual que en el portal', () => {
    expect(empresaVigente({ guardada: 'c-2', suEmpresa: '', alcanzables: ['c-1', 'c-2'], listaLista: true, admiteTodas: true })).toBe('c-2');
  });

  it('una empresa que ya no alcanza vuelve a todas, no a una cualquiera', () => {
    // Le sacaron la cuenta del pod. Caer en otra de su cartera le mostraría cifras de un local
    // que no pidió, bajo un selector que diría el nombre correcto.
    expect(empresaVigente({ guardada: 'c-9', suEmpresa: '', alcanzables: ['c-1', 'c-2'], listaLista: true, admiteTodas: true })).toBe('');
  });

  /**
   * El CRM guarda su opción «Espartanos» en la misma clave.
   *
   * Vale `espartanos`, que no es el id de ninguna empresa. En el CRM significa el embudo comercial
   * de la agencia; acá cae en «todas», que es la lectura correcta de «ninguna empresa en concreto»
   * y mantiene los dos selectores de acuerdo cuando sí se elige una.
   */
  it('la opción del CRM que no es una empresa cae en todas', () => {
    expect(empresaVigente({ guardada: 'espartanos', suEmpresa: '', alcanzables: ['c-1', 'c-2'], listaLista: true, admiteTodas: true })).toBe('');
  });

  it('con una sola cuenta en la cartera, lo guardado sigue mandando', () => {
    expect(empresaVigente({ guardada: 'c-1', suEmpresa: '', alcanzables: ['c-1'], listaLista: true, admiteTodas: true })).toBe('c-1');
  });
});
