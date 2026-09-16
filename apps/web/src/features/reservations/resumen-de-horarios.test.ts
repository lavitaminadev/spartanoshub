import { describe, expect, it } from 'vitest';
import { resumenDeHorarios } from './resumen-de-horarios';

/**
 * Quien entra un día cerrado veía una grilla vacía sin saber si el local no abre, si está lleno o
 * si algo falló. El resumen contesta eso antes de que nadie tenga que llamar a preguntar.
 */
describe('resumen de horarios', () => {
  it('junta los días seguidos con el mismo horario y nombra los cerrados', () => {
    const ventanas = [
      { day: 2, start: '18:00', end: '01:30' },
      { day: 3, start: '18:00', end: '01:30' },
      { day: 4, start: '18:00', end: '01:30' },
      { day: 5, start: '18:00', end: '02:30' },
      { day: 6, start: '18:00', end: '02:30' },
    ];
    expect(resumenDeHorarios(ventanas)).toBe('Mar a Jue 18:00–01:30 · Vie y Sáb 18:00–02:30 · Dom y Lun cerrado');
  });

  it('muestra los dos tramos de un día partido', () => {
    const ventanas = [
      { day: 1, start: '13:00', end: '16:00' },
      { day: 1, start: '19:00', end: '23:00' },
    ];
    expect(resumenDeHorarios(ventanas)).toContain('13:00–16:00 y 19:00–23:00');
  });

  it('no dice «cerrado» cuando abre todos los días', () => {
    const ventanas = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: '10:00', end: '20:00' }));
    expect(resumenDeHorarios(ventanas)).toBe('Dom a Sáb 10:00–20:00');
  });

  it('sin horarios declarados no inventa nada', () => {
    expect(resumenDeHorarios([])).toBe('');
    expect(resumenDeHorarios(undefined)).toBe('');
  });
});
