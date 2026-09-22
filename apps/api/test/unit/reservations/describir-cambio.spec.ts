/**
 * Lo que el dueño lee al revisar qué pasó con su reserva: el cambio en palabras, no la ruta
 * técnica por la que entró.
 */

import { describe, expect, it } from 'vitest';
import { describirCambio } from '../../../src/modules/reservations/application/describir-cambio';

const RUTA = 'reservations/forms/7c1f0a4e-1111-4222-8333-944455556666';

describe('describir un cambio de la auditoría', () => {
  it('nombra cada ajuste del día que se tocó, y sólo esos', () => {
    expect(describirCambio(`request:patch:${RUTA}/operacion`, { capacityPerSlot: 18, zonasActivas: ['salon'] }))
      .toBe('dejó el cupo por franja en 18, cambió las zonas que reciben hoy');
  });

  it('distingue pausar de reanudar por lo que se mandó', () => {
    expect(describirCambio(`request:patch:${RUTA}/pause`, { until: '2026-09-22T06:00' })).toBe('pausó las reservas');
    expect(describirCambio(`request:patch:${RUTA}/pause`, { until: '' })).toBe('reanudó las reservas');
  });

  it('reconoce abrir y quitar un cierre', () => {
    expect(describirCambio(`request:post:${RUTA}/blocks`, {})).toBe('cerró un día o un tramo');
    expect(describirCambio('request:delete:reservations/blocks/8d2e1b5f-1111-4222-8333-944455556666', {})).toBe('quitó un cierre');
  });

  it('separa publicar de cualquier otra edición de la configuración', () => {
    expect(describirCambio(`request:patch:${RUTA}`, { status: 'published' })).toBe('publicó la reserva');
    expect(describirCambio(`request:patch:${RUTA}`, { name: 'Terraza' })).toBe('editó la configuración');
  });

  /* Un tope en cero es quitarlo, no ponerlo en cero: así lo lee quien lo hizo. */
  it('habla de quitar cuando el valor queda en cero o vacío', () => {
    expect(describirCambio(`request:patch:${RUTA}/operacion`, { dailyCapacity: 0, notasDelLocal: '' }))
      .toBe('quitó el tope del día, quitó el aviso antes de reservar');
  });

  it('no inventa cuando no reconoce la ruta', () => {
    expect(describirCambio('', null)).toBe('hizo un cambio');
  });
});
