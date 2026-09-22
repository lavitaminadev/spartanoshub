import { describe, expect, it } from 'vitest';
import { finExtendido, horaDeCierre } from '../../../src/modules/reservations/domain/cierre-del-local';

const ZONA = 'America/Santiago';
// Martes 22-09-2026, 20:00 en Santiago (UTC-3).
const MARTES_20H = new Date('2026-09-22T23:00:00.000Z');

describe('horaDeCierre', () => {
  it('es el fin del tramo en que empieza la reserva', () => {
    const cierre = horaDeCierre(MARTES_20H, ZONA, [{ day: 2, start: '12:00', end: '16:00' }, { day: 2, start: '19:00', end: '23:30' }]);
    expect(cierre?.toISOString()).toBe('2026-09-23T02:30:00.000Z');
  });

  it('un fin de 24:00 es la medianoche siguiente', () => {
    expect(horaDeCierre(MARTES_20H, ZONA, [{ day: 2, start: '19:00', end: '24:00' }])?.toISOString()).toBe('2026-09-23T03:00:00.000Z');
  });

  it('sin tramo para ese día o esa hora no inventa un cierre', () => {
    expect(horaDeCierre(MARTES_20H, ZONA, [{ day: 3, start: '19:00', end: '23:00' }])).toBeNull();
    expect(horaDeCierre(MARTES_20H, ZONA, [{ day: 2, start: '12:00', end: '16:00' }])).toBeNull();
  });
});

describe('finExtendido', () => {
  it('suma media hora al fin previsto mientras no haya pasado', () => {
    expect(finExtendido(new Date('2026-09-23T01:00:00Z'), new Date('2026-09-23T00:40:00Z')).toISOString()).toBe('2026-09-23T01:30:00.000Z');
  });

  it('pasado el fin, la media hora se cuenta desde ahora y no regala tiempo ya transcurrido', () => {
    expect(finExtendido(new Date('2026-09-23T01:00:00Z'), new Date('2026-09-23T01:20:00Z')).toISOString()).toBe('2026-09-23T01:50:00.000Z');
  });
});
