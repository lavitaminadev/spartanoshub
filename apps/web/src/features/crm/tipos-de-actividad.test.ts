import { describe, expect, it } from 'vitest';
import {
  MEDIOS,
  TIPOS_AGENDABLES,
  TIPO_DE_ACTIVIDAD,
  admiteMedio,
  campoDelMedio,
  rotuloDeMedio,
} from './tipos-de-actividad';

/**
 * El catálogo único de tipos de actividad.
 *
 * Existe porque estaban escritos por separado en el calendario y en la ficha, y `meeting` acabó
 * llamándose «Visita» en uno y «Reunión» en el otro. Estas pruebas cuidan sobre todo que no
 * vuelva a haber dos verdades.
 */
describe('tipos de actividad', () => {
  it('cada tipo agendable sale del catálogo, no de una copia', () => {
    for (const tipo of TIPOS_AGENDABLES) {
      expect(tipo.label).toBe(TIPO_DE_ACTIVIDAD[tipo.value]);
    }
  });

  it('reunión y visita son cosas distintas y no comparten rótulo', () => {
    expect(TIPO_DE_ACTIVIDAD.meeting).toBe('Reunión');
    expect(TIPO_DE_ACTIVIDAD.visit).toBe('Visita');
  });

  /*
   * Una llamada ya dice por dónde ocurre y una nota no ocurre en ninguna parte: pedirles medio
   * sería pedir un dato que no significa nada.
   */
  it.each([
    ['meeting', true],
    ['visit', true],
    ['call', false],
    ['note', false],
    [undefined, false],
  ])('«%s» admite medio: %s', (tipo, esperado) => {
    expect(admiteMedio(tipo)).toBe(esperado);
  });

  it('los medios de videollamada piden enlace', () => {
    for (const medio of ['meet', 'zoom', 'teams']) {
      expect(campoDelMedio(medio)?.etiqueta).toBe('Enlace de la reunión');
    }
  });

  it('la presencial pide dirección y la telefónica no pide nada', () => {
    expect(campoDelMedio('presencial')?.etiqueta).toBe('Dirección');
    expect(campoDelMedio('telefono')).toBeNull();
  });

  it('sin medio elegido no se pide nada', () => {
    expect(campoDelMedio(null)).toBeNull();
    expect(campoDelMedio('')).toBeNull();
  });

  it('un medio guardado que ya no esté en la lista se muestra tal cual, sin romper la ficha', () => {
    expect(rotuloDeMedio('skype')).toBe('skype');
    expect(rotuloDeMedio(null)).toBe('');
  });

  it('todos los medios tienen rótulo legible', () => {
    for (const medio of MEDIOS) {
      expect(rotuloDeMedio(medio.value)).toBe(medio.label);
    }
  });
});
