/**
 * Un cambio que el calendario del local no alcanzó a recibir se reintenta.
 *
 * Mover o cancelar una reserva toca el evento del Google Calendar del local fuera de la
 * transacción. Si Google no responde, el evento queda con la hora vieja —o sigue ocupando la hora
 * de una reserva cancelada— y la reserva **sí** tiene `calendar_event_id`, así que la búsqueda de
 * integraciones faltantes no la ve. La marca `calendar_sync_pending` es lo que la trae de vuelta.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RecoverReservationIntegrationsJob } from '../../../src/core/jobs/cron/recover-reservation-integrations.job';

const FORMULARIO = { id: 'f1', organizationId: 'org-1', clientId: 'cli-1', name: 'Refugio', calendarEnabled: true, crmEnabled: false };

function reserva(extra: Record<string, unknown> = {}) {
  return {
    id: 'r1',
    formId: 'f1',
    organizationId: 'org-1',
    guestName: 'Camila',
    referenceCode: 'ABC123',
    startsAt: new Date('2026-10-20T21:00:00.000Z'),
    endsAt: new Date('2026-10-20T23:00:00.000Z'),
    status: 'confirmed',
    calendarEventId: 'ev-1',
    calendarSyncPending: 'mover',
    ...extra,
  };
}

/** `pending` (columna vacía) no devuelve nada; `pendingSync` devuelve lo que se le pase. */
function armar(pendientesDeSincronizar: unknown[]) {
  const reservations = {
    update: vi.fn().mockResolvedValue(undefined),
    createQueryBuilder: vi.fn(() => {
      let esDeSincronizacion = false;
      const qb: Record<string, unknown> = {
        where: vi.fn((condicion: string) => { esDeSincronizacion = condicion.includes('calendar_sync_pending'); return qb; }),
        andWhere: vi.fn(() => qb),
        orderBy: vi.fn(() => qb),
        take: vi.fn(() => qb),
        getMany: vi.fn(async () => (esDeSincronizacion ? pendientesDeSincronizar : [])),
      };
      return qb;
    }),
  };
  const forms = { findOne: vi.fn().mockResolvedValue(FORMULARIO) };
  const calendar = {
    createEvent: vi.fn(),
    updateEvent: vi.fn().mockResolvedValue({ existe: true, calendarUrl: 'https://calendar/ev-1' }),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
  };
  const leadIntake = { captureAudience: vi.fn() };
  const job = new RecoverReservationIntegrationsJob(reservations as never, forms as never, calendar as never, leadIntake as never);
  return { job, reservations, forms, calendar };
}

describe('calendario pendiente de sincronizar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reaplica el movimiento con la hora que la reserva tiene ahora, y borra la marca', async () => {
    const { job, reservations, calendar } = armar([reserva()]);

    const resultado = await job.handle();

    expect(calendar.updateEvent).toHaveBeenCalledWith('org-1', 'ev-1', expect.objectContaining({
      start: new Date('2026-10-20T21:00:00.000Z'),
      durationMinutes: 120,
    }));
    expect(reservations.update).toHaveBeenCalledWith('r1', expect.objectContaining({ calendarSyncPending: null }));
    expect(resultado.calendar).toBe(1);
  });

  it('una cancelación que no llegó se reintenta aunque la reserva esté cancelada', async () => {
    // Es justo el caso que deja una mesa ocupada en la pantalla que mira el equipo antes de abrir.
    const { job, reservations, calendar } = armar([reserva({ status: 'cancelled_by_guest', calendarSyncPending: 'borrar' })]);

    await job.handle();

    expect(calendar.deleteEvent).toHaveBeenCalledWith('org-1', 'ev-1');
    expect(reservations.update).toHaveBeenCalledWith('r1', expect.objectContaining({ calendarEventId: undefined, calendarSyncPending: null }));
  });

  it('si Google sigue caído la marca se queda puesta para el próximo pase', async () => {
    const { job, reservations, calendar } = armar([reserva()]);
    calendar.updateEvent.mockRejectedValue(new Error('503'));

    const resultado = await job.handle();

    expect(resultado.failed).toBe(1);
    expect(reservations.update).not.toHaveBeenCalled();
  });

  it('si el evento ya no existe se olvida el id para que el otro pase vuelva a crearlo', async () => {
    const { job, reservations, calendar } = armar([reserva()]);
    calendar.updateEvent.mockResolvedValue({ existe: false });

    await job.handle();

    expect(reservations.update).toHaveBeenCalledWith('r1', { calendarEventId: undefined, calendarUrl: undefined, calendarSyncPending: null });
  });

  it('sin calendario en el formulario la marca se limpia en vez de mirarse en cada pase', async () => {
    const { job, reservations, forms, calendar } = armar([reserva()]);
    forms.findOne.mockResolvedValue({ ...FORMULARIO, calendarEnabled: false });

    await job.handle();

    expect(calendar.updateEvent).not.toHaveBeenCalled();
    expect(reservations.update).toHaveBeenCalledWith('r1', { calendarSyncPending: null });
  });
});
