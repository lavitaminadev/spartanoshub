import { describe, expect, it } from 'vitest';
import { lineaDeCotizaciones } from './cotizaciones-del-lead';

const ahora = new Date('2026-04-20T12:00:00Z');

describe('lineaDeCotizaciones', () => {
  it('no escribe nada cuando no hay cotizaciones', () => {
    expect(lineaDeCotizaciones(0, null, ahora)).toBeNull();
  });
  it('dice cuántas veces y hace cuántos días', () => {
    expect(lineaDeCotizaciones(2, '2026-03-11T12:00:00Z', ahora)).toBe('Cotizó 2 veces, la última hace 40 días');
  });
  it('singular y hoy', () => {
    expect(lineaDeCotizaciones(1, '2026-04-20T08:00:00Z', ahora)).toBe('Cotizó 1 vez, la última hoy');
  });
});
