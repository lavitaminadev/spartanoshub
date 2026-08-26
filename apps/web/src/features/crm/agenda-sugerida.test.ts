import { describe, expect, it } from 'vitest';
import { proximaFechaSugerida } from './agenda-sugerida';

describe('fecha propuesta al agendar', () => {
  it('propone el día siguiente a las 10:00', () => {
    expect(proximaFechaSugerida(new Date(2026, 7, 26, 15, 42))).toBe('2026-08-27T10:00');
  });

  it('rellena mes y día a dos dígitos', () => {
    // Sin el relleno el campo no acepta el valor y aparece vacío, sin decir por qué.
    expect(proximaFechaSugerida(new Date(2026, 0, 4, 9, 0))).toBe('2026-01-05T10:00');
  });

  it('salta el fin de semana', () => {
    // Viernes 28 de agosto de 2026 → lunes 31, no sábado 29.
    expect(proximaFechaSugerida(new Date(2026, 7, 28, 11, 0))).toBe('2026-08-31T10:00');
    // Sábado 29 → lunes 31 también.
    expect(proximaFechaSugerida(new Date(2026, 7, 29, 11, 0))).toBe('2026-08-31T10:00');
  });

  it('cruza el fin de año sin perderse', () => {
    expect(proximaFechaSugerida(new Date(2026, 11, 31, 20, 0))).toBe('2027-01-01T10:00');
  });
});
