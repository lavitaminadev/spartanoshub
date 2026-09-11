import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';

/**
 * Los avisos a quien reserva salen de Ajustes, cada uno con su interruptor.
 *
 * Tenían el texto escrito en el código: no se podían apagar ni adaptar, y el de cambio o
 * cancelación salía siempre, aunque la empresa hubiera apagado los correos.
 */
const forms = { findOne: vi.fn() };
const emails = { send: vi.fn().mockResolvedValue(true) };
const parametros = { get: vi.fn() };

function servicio(): ReservationsService {
  const vacio = {} as never;
  return new ReservationsService(
    forms as never, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio,
    vacio, emails as never, vacio, vacio, vacio, vacio, parametros as never, vacio, vacio,
  );
}

const local = { id: 'form-1', organizationId: 'org-1', clientId: 'client-1', name: 'Casa Costanera', timezone: 'America/Santiago', designConfig: {} };
const reserva = {
  id: 'res-1', formId: 'form-1', guestName: 'Ana', guestEmail: 'ana@example.cl', partySize: 2, referenceCode: 'CC-1044',
  startsAt: new Date('2026-09-13T00:00:00Z'), endsAt: new Date('2026-09-13T01:30:00Z'),
};

type Privado = {
  sendCalendarUpdate: (b: unknown, m: 'CANCELLED' | 'PUBLISH', r?: string) => Promise<void>;
  avisarSolicitudSinCupo: (f: unknown, t: 'grupo' | 'espera', d: unknown) => Promise<void>;
};
const privado = (s: ReservationsService) => s as unknown as Privado;

/** Ajustes que responden solo lo indicado; lo demás cae al valor de fábrica del catálogo. */
function ajustes(valores: Record<string, unknown>) {
  parametros.get.mockImplementation((key: string) => Promise.resolve(key in valores ? valores[key] : null));
}

describe('plantillas de avisos a quien reserva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forms.findOne.mockResolvedValue(local);
    ajustes({});
  });

  it('la cancelación sale con el texto de fábrica si nadie lo cambió', async () => {
    await privado(servicio()).sendCalendarUpdate(reserva, 'CANCELLED', 'Cierre por evento');
    const [, asunto, cuerpo, opciones] = emails.send.mock.calls[0];
    expect(asunto).toBe('Tu reserva en Casa Costanera fue cancelada');
    expect(cuerpo).toContain('Motivo: Cierre por evento');
    expect(opciones.attachments[0].filename).toBe('reserva-cancelada.ics');
  });

  /** Antes salía siempre, aunque la empresa hubiera apagado los correos. */
  it('respeta el interruptor de la cancelación', async () => {
    ajustes({ 'email.reservation_cancellation_enabled': false });
    await privado(servicio()).sendCalendarUpdate(reserva, 'CANCELLED');
    expect(emails.send).not.toHaveBeenCalled();
  });

  it('usa el asunto que escribió la empresa para el cambio de hora', async () => {
    ajustes({ 'email.reservation_change_subject': 'Cambiamos tu mesa en {{local}}' });
    await privado(servicio()).sendCalendarUpdate(reserva, 'PUBLISH');
    expect(emails.send.mock.calls[0][1]).toBe('Cambiamos tu mesa en Casa Costanera');
    expect(emails.send.mock.calls[0][2]).toContain('9:00');
  });

  /** El acuse de grupo tiene su propio interruptor: ya no depende del de la confirmación. */
  it('el acuse de grupo sigue su interruptor y no el de la confirmación', async () => {
    ajustes({ 'email.reservation_confirmation_enabled': true });
    await privado(servicio()).avisarSolicitudSinCupo(local, 'grupo', { id: 'g-1', guestName: 'Ana', guestEmail: 'ana@example.cl', partySize: 12, cuando: '20 de septiembre' });
    expect(emails.send).not.toHaveBeenCalled();

    ajustes({ 'email.group_request_ack_enabled': true });
    await privado(servicio()).avisarSolicitudSinCupo(local, 'grupo', { id: 'g-1', guestName: 'Ana', guestEmail: 'ana@example.cl', partySize: 12, cuando: '20 de septiembre' });
    expect(emails.send).toHaveBeenCalledWith('ana@example.cl', 'Recibimos tu solicitud de evento en Casa Costanera', expect.any(String), expect.anything());
  });
});
