/**
 * La pregunta conectada a la grilla de ocasiones mantiene una sola lista: «No» más cada ocasión.
 */

import { describe, expect, it } from 'vitest';
import { sincronizarPreguntaDeOcasiones } from './ReservationBuilderPage';
import type { FormField } from './types';

const campos: FormField[] = [
  { id: 'nombre', type: 'text', label: 'Nombre', required: true },
  { id: 'ocasion', type: 'select', label: '¿Celebras algo?', required: false, options: ['No', 'Cumpleaños'] },
];
const grilla = JSON.stringify([{ titulo: 'Cumpleaños' }, { titulo: 'Aniversario' }, { titulo: 'Empresa' }]);

describe('sincronizarPreguntaDeOcasiones', () => {
  it('sin pregunta conectada no toca nada', () => {
    expect(sincronizarPreguntaDeOcasiones({ ocasiones: grilla }, campos)).toBe(campos);
  });

  it('la pregunta conectada toma «No» más las ocasiones de la grilla', () => {
    const resultado = sincronizarPreguntaDeOcasiones({ ocasiones: grilla, ocasionesPreguntaId: 'ocasion' }, campos);
    expect(resultado[1].options).toEqual(['No', 'Cumpleaños', 'Aniversario', 'Empresa']);
    expect(resultado[0]).toBe(campos[0]);
  });

  it('con la grilla vacía conserva las opciones que tenía, para no dejar la pregunta sin respuestas', () => {
    expect(sincronizarPreguntaDeOcasiones({ ocasiones: '[]', ocasionesPreguntaId: 'ocasion' }, campos)[1].options).toEqual(['No', 'Cumpleaños']);
  });

  it('no repite «No» ni ocasiones con el mismo título', () => {
    const repetidas = JSON.stringify([{ titulo: 'No' }, { titulo: 'Empresa' }, { titulo: 'Empresa' }]);
    expect(sincronizarPreguntaDeOcasiones({ ocasiones: repetidas, ocasionesPreguntaId: 'ocasion' }, campos)[1].options).toEqual(['No', 'Empresa']);
  });
});
