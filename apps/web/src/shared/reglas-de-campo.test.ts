/**
 * Qué se garantiza: una pregunta condicional se muestra exactamente cuando su condición se
 * cumple, y lo que se esconde deja de arrastrar a lo que dependía de ello.
 *
 * Vive en la web porque es donde se consume a diario, pero la función es compartida: el servidor
 * evalúa la misma para no exigir un campo que nadie vio.
 */

import { describe, expect, it } from 'vitest';
import { campoVisible, camposVisibles } from '@espartanos/shared';

describe('campoVisible', () => {
  it('muestra un campo sin condición', () => {
    expect(campoVisible({ id: 'notas' }, {})).toBe(true);
  });

  it('compara sin distinguir mayúsculas ni espacios sobrantes', () => {
    const campo = { id: 'cuantos', mostrarSi: { campo: 'ninos', operador: 'igual' as const, valor: 'Sí' } };
    expect(campoVisible(campo, { ninos: ' sí ' })).toBe(true);
    expect(campoVisible(campo, { ninos: 'no' })).toBe(false);
  });

  it('trata una selección múltiple igual que un valor suelto', () => {
    const campo = { id: 'detalle', mostrarSi: { campo: 'menu', operador: 'igual' as const, valor: 'vegano' } };
    expect(campoVisible(campo, { menu: ['Vegano', 'Sin gluten'] })).toBe(true);
    expect(campoVisible(campo, { menu: ['Sin gluten'] })).toBe(false);
  });

  it('distingue una respuesta vacía de una respondida', () => {
    const respondido = { id: 'a', mostrarSi: { campo: 'x', operador: 'respondido' as const } };
    const vacio = { id: 'b', mostrarSi: { campo: 'x', operador: 'vacio' as const } };
    expect(campoVisible(respondido, { x: '' })).toBe(false);
    expect(campoVisible(respondido, { x: 'algo' })).toBe(true);
    expect(campoVisible(vacio, { x: [] })).toBe(true);
  });

  it('compara números con mayor que, y no con texto', () => {
    const campo = { id: 'detalle', mostrarSi: { campo: 'personas', operador: 'mayor_que' as const, valor: '8' } };
    expect(campoVisible(campo, { personas: 9 })).toBe(true);
    expect(campoVisible(campo, { personas: 8 })).toBe(false);
    expect(campoVisible(campo, { personas: 'muchas' })).toBe(false);
  });

  /*
   * Lo aún no respondido cuenta como vacío. Si la ausencia mostrara la pregunta, todas las
   * condicionales aparecerían al abrir el formulario y recién se esconderían al responder la
   * primera: al revés de lo que se configuró.
   */
  it('parte oculta mientras no se responda aquello de lo que depende', () => {
    expect(campoVisible({ id: 'a', mostrarSi: { campo: 'x', operador: 'igual', valor: 'si' } }, {})).toBe(false);
    expect(campoVisible({ id: 'b', mostrarSi: { campo: 'x', operador: 'vacio' } }, {})).toBe(true);
  });

  /*
   * «Distinta de No» describe una respuesta dada, no la ausencia de respuesta: si la ausencia
   * bastara, la pregunta condicional aparecería al abrir el formulario. Para preguntar por la
   * ausencia está el operador «esté vacía».
   */
  it('no da por cumplido «distinta de» ni «contenga» con la respuesta vacía', () => {
    expect(campoVisible({ id: 'a', mostrarSi: { campo: 'x', operador: 'distinto', valor: 'no' } }, {})).toBe(false);
    expect(campoVisible({ id: 'a', mostrarSi: { campo: 'x', operador: 'distinto', valor: 'no' } }, { x: 'cumpleanos' })).toBe(true);
    expect(campoVisible({ id: 'b', mostrarSi: { campo: 'x', operador: 'contiene', valor: 'a' } }, { x: '' })).toBe(false);
  });

  it('ignora un operador que esta versión no conoce', () => {
    expect(campoVisible({ id: 'a', mostrarSi: { campo: 'x', operador: 'futuro' as never, valor: '1' } }, { x: '2' })).toBe(true);
  });
});

describe('camposVisibles', () => {
  it('esconde también lo que dependía de una pregunta escondida', () => {
    const campos = [
      { id: 'ninos' },
      { id: 'cuantos', mostrarSi: { campo: 'ninos', operador: 'igual' as const, valor: 'si' } },
      { id: 'edades', mostrarSi: { campo: 'cuantos', operador: 'respondido' as const } },
    ];
    // «cuantos» se esconde por su condición; «edades» no puede quedar visible por una respuesta
    // vieja que quedó guardada cuando sí se preguntaba.
    const visibles = camposVisibles(campos, { ninos: 'no', cuantos: '3' });
    expect(visibles.map((campo) => campo.id)).toEqual(['ninos']);
  });

  /*
   * Esconder por un identificador roto dejaría un formulario incompleto que nadie puede
   * diagnosticar mirando la página: eso sí se muestra, y sólo lo puede saber quien ve la lista.
   */
  it('muestra la pregunta cuya condición apunta a un campo que ya no existe', () => {
    const visibles = camposVisibles([{ id: 'a', mostrarSi: { campo: 'borrado', operador: 'igual' as const, valor: 'x' } }], {});
    expect(visibles.map((campo) => campo.id)).toEqual(['a']);
  });

  it('deja pasar toda la cadena cuando la condición se cumple', () => {
    const campos = [
      { id: 'ninos' },
      { id: 'cuantos', mostrarSi: { campo: 'ninos', operador: 'igual' as const, valor: 'si' } },
      { id: 'edades', mostrarSi: { campo: 'cuantos', operador: 'respondido' as const } },
    ];
    const visibles = camposVisibles(campos, { ninos: 'si', cuantos: '3' });
    expect(visibles.map((campo) => campo.id)).toEqual(['ninos', 'cuantos', 'edades']);
  });
});
