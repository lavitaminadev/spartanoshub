import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';

/**
 * Recuperar la reserva sin el código.
 *
 * El enlace se manda al correo de la reserva y nunca se muestra en pantalla: si la página listara
 * reservas por correo, cualquiera podría escribir el de otra persona y cancelarle la mesa. Y la
 * respuesta es la misma haya o no reservas, para no revelar quién reservó dónde.
 */
const forms = { findOne: vi.fn() };
const reservations = { find: vi.fn() };
const emails = { send: vi.fn().mockResolvedValue(true) };
const tokens = { create: vi.fn((v) => v), save: vi.fn((v) => v) };
// Sin valor propio en Ajustes: se usa el de fábrica del catálogo, que viene encendido.
const parametros = { get: vi.fn().mockResolvedValue(null) };

function servicio(): ReservationsService {
  const vacio = {} as never;
  return new ReservationsService(
    forms as never, reservations as never, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio,
    vacio, emails as never, vacio, vacio, vacio, vacio, parametros as never, tokens as never, vacio,
  );
}

const local = { id: 'form-1', name: 'Casa Costanera', timezone: 'America/Santiago', designConfig: {} };
const reserva = { id: 'res-1', guestName: 'Ana', partySize: 2, referenceCode: '3F9A1C2B7D10', startsAt: new Date('2026-09-20T00:00:00Z'), endsAt: new Date('2026-09-20T01:30:00Z') };

describe('recuperar la reserva por correo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forms.findOne.mockResolvedValue(local);
    reservations.find.mockResolvedValue([reserva]);
  });

  it('manda el enlace al correo de la reserva, no a la pantalla', async () => {
    const respuesta = await servicio().recoverPublicReservations('casa', ' Ana@Example.cl ');
    expect(respuesta).toEqual({ sent: true });
    expect(respuesta).not.toHaveProperty('token');
    expect(emails.send).toHaveBeenCalledTimes(1);
    expect(emails.send.mock.calls[0][0]).toBe('ana@example.cl');
    expect(tokens.save).toHaveBeenCalledWith(expect.objectContaining({ reservationId: 'res-1' }));
  });

  it('busca solo en este local y en reservas que aún pueden cambiarse', async () => {
    await servicio().recoverPublicReservations('casa', 'ana@example.cl');
    const { where } = reservations.find.mock.calls[0][0];
    expect(where.formId).toBe('form-1');
    expect(where.guestEmail).toBe('ana@example.cl');
  });

  it('no envía nada si la empresa apagó el aviso', async () => {
    parametros.get.mockImplementation((key: string) => Promise.resolve(key === 'email.reservation_recovery_enabled' ? false : null));
    await expect(servicio().recoverPublicReservations('casa', 'ana@example.cl')).resolves.toEqual({ sent: true });
    expect(emails.send).not.toHaveBeenCalled();
    parametros.get.mockResolvedValue(null);
  });

  /** Mismo resultado con o sin reservas: no se revela quién reservó dónde. */
  it('responde igual cuando no hay reservas o el local no existe', async () => {
    reservations.find.mockResolvedValue([]);
    await expect(servicio().recoverPublicReservations('casa', 'nadie@example.cl')).resolves.toEqual({ sent: true });
    forms.findOne.mockResolvedValue(null);
    await expect(servicio().recoverPublicReservations('otro', 'ana@example.cl')).resolves.toEqual({ sent: true });
    expect(emails.send).not.toHaveBeenCalled();
    expect(tokens.save).not.toHaveBeenCalled();
  });
});
