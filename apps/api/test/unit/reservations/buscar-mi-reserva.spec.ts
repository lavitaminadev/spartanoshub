import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';

/**
 * Volver a una reserva sin el correo ni el navegador con que se hizo.
 *
 * El código solo no basta —aparece impreso, se comparte en un chat—, así que se pide también el
 * correo o el teléfono. Y la respuesta al fallar es siempre la misma: si dijera «el código existe
 * pero el correo no coincide», cualquiera podría probar códigos hasta dar con uno real.
 */
const forms = { findOne: vi.fn() };
const reservations = { findOne: vi.fn() };
const tokens = { create: vi.fn((v) => v), save: vi.fn((v) => v) };

function servicio(): ReservationsService {
  const vacio = {} as never;
  return new ReservationsService(
    forms as never, reservations as never, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio,
    vacio, vacio, vacio, vacio, vacio, vacio, vacio, tokens as never, vacio,
  );
}

const reserva = { id: 'res-1', formId: 'form-1', referenceCode: '3F9A1C2B7D10', guestEmail: 'ana@example.cl', guestPhone: '+56912345678', endsAt: new Date('2026-09-20T01:00:00Z') };

describe('buscar mi reserva', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forms.findOne.mockResolvedValue({ id: 'form-1' });
    reservations.findOne.mockResolvedValue(reserva);
  });

  it('entrega un enlace nuevo con código y correo', async () => {
    const { token } = await servicio().lookupPublicReservation('casa', '3f9a1c2b7d10', ' Ana@Example.cl ');
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(tokens.save).toHaveBeenCalledWith(expect.objectContaining({ reservationId: 'res-1' }));
    expect(reservations.findOne).toHaveBeenCalledWith({ where: { formId: 'form-1', referenceCode: '3F9A1C2B7D10' } });
  });

  it('acepta el teléfono escrito de otra forma', async () => {
    await expect(servicio().lookupPublicReservation('casa', '3F9A1C2B7D10', '9 1234 5678')).resolves.toHaveProperty('token');
  });

  /** Mismo mensaje en los tres casos: no confirmar que un código existe. */
  it('responde igual si falla el contacto, el código o el local', async () => {
    const mensajes: string[] = [];
    for (const preparar of [
      () => undefined,
      () => reservations.findOne.mockResolvedValue(null),
      () => forms.findOne.mockResolvedValue(null),
    ]) {
      preparar();
      const error = await servicio().lookupPublicReservation('casa', '3F9A1C2B7D10', 'otra@example.cl').catch((e) => e);
      expect(error).toBeInstanceOf(NotFoundException);
      mensajes.push(error.message);
    }
    expect(new Set(mensajes).size).toBe(1);
    expect(tokens.save).not.toHaveBeenCalled();
  });
});
