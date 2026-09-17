import { describe, expect, it } from 'vitest';
import { estadoDelCanal, loQueFaltaParaAbrir } from './preparacion-del-local';
import type { ReservationForm } from './types';

const base = {
  id: 'r1', clientId: 'c1', name: 'Casa Costanera', publicSlug: 'casa', status: 'published',
  durationMinutes: 90, capacityPerSlot: 20, dailyCapacity: 0, minimumNoticeHours: 2, maximumAdvanceDays: 60,
  bufferMinutes: 0, timezone: 'America/Santiago', confirmationMode: 'automatic', mode: 'appointment',
  fieldSchema: [{ id: 'name', type: 'text', label: 'Nombre', required: true }],
  scheduleConfig: { windows: [{ day: 1, start: '13:00', end: '23:00' }] },
  designConfig: {}, servicesConfig: [], resourcesConfig: [],
} as unknown as ReservationForm;

/**
 * El estado que se muestra es el de quien abre el enlace, no el de la fila en la base: una
 * reserva publicada y pausada no está recibiendo a nadie.
 */
describe('estado del canal', () => {
  it('publicada y sin pausa está recibiendo reservas', () => {
    expect(estadoDelCanal(base).tono).toBe('abierto');
  });

  it('una pausa futura manda sobre el estado publicado', () => {
    const futuro = new Date(Date.now() + 3600_000).toISOString();
    const local = { ...base, designConfig: { bookingPausedUntil: futuro } } as ReservationForm;
    expect(estadoDelCanal(local)).toMatchObject({ etiqueta: 'Pausada', tono: 'pausado' });
  });

  it('una pausa vencida no pausa nada', () => {
    const pasado = new Date(Date.now() - 3600_000).toISOString();
    const local = { ...base, designConfig: { bookingPausedUntil: pasado } } as ReservationForm;
    expect(estadoDelCanal(local).tono).toBe('abierto');
  });

  it('el estado pausado del registro también pausa el canal', () => {
    expect(estadoDelCanal({ ...base, status: 'paused' } as ReservationForm)).toMatchObject({ etiqueta: 'Pausada', tono: 'pausado' });
  });

  it('sin publicar dice que nadie puede reservar', () => {
    expect(estadoDelCanal({ ...base, status: 'draft' } as ReservationForm).tono).toBe('cerrado');
  });
});

describe('lo que falta para abrir', () => {
  it('con todo puesto no queda nada pendiente', () => {
    expect(loQueFaltaParaAbrir(base).every((requisito) => requisito.listo)).toBe(true);
  });

  it('sin franjas marca el horario como lo que falta', () => {
    const local = { ...base, scheduleConfig: { windows: [] } } as unknown as ReservationForm;
    const horario = loQueFaltaParaAbrir(local).find((requisito) => requisito.clave === 'horario');
    expect(horario).toMatchObject({ listo: false });
    expect(horario?.detalle).toContain('Sin franjas');
  });

  it('cuenta lo que hay puesto en cada requisito', () => {
    const detalles = loQueFaltaParaAbrir(base).map((requisito) => requisito.detalle);
    expect(detalles).toContain('20 por horario');
    expect(detalles).toContain('90 minutos');
    expect(detalles).toContain('1 campo');
  });
});
