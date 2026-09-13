/**
 * Qué se garantiza: el servidor no exige una pregunta que la página pública no llegó a mostrar,
 * y sigue exigiendo la que sí se mostró.
 *
 * Es el contrato que hace utilizable una pregunta condicional obligatoria. Si los dos lados no
 * coincidieran, la persona vería un error nombrando un campo que no está en su pantalla, sin
 * ninguna forma de completarlo.
 */

import { describe, expect, it } from 'vitest';
import { camposVisibles } from '@espartanos/shared';

/** El mismo recorte que hace el servicio antes de revisar lo obligatorio. */
function obligatoriosPendientes(
  fieldSchema: Array<{ id: string; label: string; required: boolean; mostrarSi?: { campo: string; operador: 'igual' | 'respondido'; valor?: string } }>,
  respuestas: Record<string, unknown>,
): string[] {
  return camposVisibles(fieldSchema, respuestas)
    .filter((campo) => campo.required)
    .filter((campo) => {
      const valor = respuestas[campo.id];
      return valor === undefined || valor === null || valor === '' || valor === false;
    })
    .map((campo) => campo.label);
}

const ESQUEMA = [
  { id: 'ninos', label: '¿Vienen niños?', required: true },
  { id: 'cuantos', label: '¿Cuántos niños?', required: true, mostrarSi: { campo: 'ninos', operador: 'igual' as const, valor: 'si' } },
];

describe('preguntas condicionales', () => {
  it('no exige la pregunta oculta', () => {
    expect(obligatoriosPendientes(ESQUEMA, { ninos: 'no' })).toEqual([]);
  });

  it('exige la pregunta cuando la condición la muestra', () => {
    expect(obligatoriosPendientes(ESQUEMA, { ninos: 'si' })).toEqual(['¿Cuántos niños?']);
  });

  it('la da por cumplida cuando está visible y respondida', () => {
    expect(obligatoriosPendientes(ESQUEMA, { ninos: 'si', cuantos: '2' })).toEqual([]);
  });

  it('sigue exigiendo la pregunta que no depende de nadie', () => {
    expect(obligatoriosPendientes(ESQUEMA, {})).toEqual(['¿Vienen niños?']);
  });
});
