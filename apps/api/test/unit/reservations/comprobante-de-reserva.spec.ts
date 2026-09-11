import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';

/**
 * Lo que el correo le dice a quien reserva.
 *
 * Una reserva nace `pending` cuando el local revisa a mano o cuando el grupo es grande, y en ese
 * estado no hay mesa asegurada. El comprobante usaba igualmente la plantilla de confirmación, así
 * que la persona leía «tu reserva está confirmada» y el local se encontraba con alguien que
 * llegaba sin cupo. Estas pruebas fijan que el texto y el adjunto digan la verdad del estado.
 */
const emails = { send: vi.fn().mockResolvedValue(undefined) };
const parametros = { get: vi.fn() };
const forms = { findOne: vi.fn() };

function servicio(): ReservationsService {
  const vacio = {} as never;
  return new ReservationsService(
    forms as never, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio,
    vacio, emails as never, vacio, vacio, vacio, vacio, parametros as never, vacio, vacio,
  );
}

const formulario = { id: 'form-1', organizationId: 'org-1', clientId: 'client-1', name: 'Casa Costanera', timezone: 'America/Santiago', designConfig: {} };

function reserva(status: string) {
  return {
    id: 'res-1', guestName: 'Ana', guestEmail: 'ana@example.cl', partySize: 2, status,
    referenceCode: 'CC-1044',
    // 21:00 en Santiago; en UTC ya es el día siguiente.
    startsAt: new Date('2026-09-13T00:00:00Z'),
    endsAt: new Date('2026-09-13T01:30:00Z'),
  };
}

/** `enviarComprobante` es privado: se alcanza por nombre para no exponerlo solo por la prueba. */
function enviarComprobante(service: ReservationsService, booking: unknown, token?: string) {
  return (service as unknown as { enviarComprobante: (f: unknown, b: unknown, t?: string) => Promise<void> })
    .enviarComprobante(formulario, booking, token);
}

describe('comprobante de reserva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parametros.get.mockImplementation((key: string) => {
      if (key === 'email.reservation_confirmation_enabled') return Promise.resolve(true);
      if (key === 'email.reservation_confirmation_subject') return Promise.resolve('Tu reserva en {{local}} está confirmada');
      if (key === 'email.reservation_confirmation_body') return Promise.resolve('Tu reserva quedó confirmada para el {{fecha}}.');
      return Promise.resolve(null);
    });
  });

  it('no afirma una confirmación que todavía no ocurrió', async () => {
    await enviarComprobante(servicio(), reserva('pending'));
    const [, asunto, cuerpo] = emails.send.mock.calls[0];
    expect(asunto).toBe('Recibimos tu solicitud en Casa Costanera');
    expect(cuerpo).toContain('Todavía no está confirmada');
    expect(cuerpo).not.toContain('quedó confirmada');
  });

  /** Un `.ics` de una cita que el local aún puede rechazar deja basura en el calendario. */
  it('no adjunta calendario mientras está pendiente', async () => {
    await enviarComprobante(servicio(), reserva('pending'));
    expect(emails.send.mock.calls[0][3]?.attachments).toBeUndefined();
  });

  it('usa la plantilla de la empresa cuando ya está confirmada', async () => {
    await enviarComprobante(servicio(), reserva('confirmed'));
    const [, asunto, , opciones] = emails.send.mock.calls[0];
    expect(asunto).toBe('Tu reserva en Casa Costanera está confirmada');
    expect(opciones?.attachments?.[0]?.filename).toBe('reserva.ics');
  });

  /**
   * El proceso corre en UTC. Sin la zona del local, una reserva de las 21:00 en Santiago se
   * anunciaba como medianoche del día siguiente: un día entero de diferencia.
   */
  it('escribe la hora del local y no la del servidor', async () => {
    await enviarComprobante(servicio(), reserva('confirmed'));
    const cuerpo = emails.send.mock.calls[0][2] as string;
    expect(cuerpo).toContain('12 de septiembre de 2026');
    expect(cuerpo).toMatch(/9:00\s?p\.\s?m\./);
    expect(cuerpo).not.toContain('13 de septiembre');
  });
});
