import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';

/**
 * De solicitud de grupo a reserva real.
 *
 * El equipo tenía que volver a escribir nombre, contacto, cantidad y todo lo contestado. Ahora
 * pone fecha y zona; el resto sale de la solicitud, y una solicitud no se convierte dos veces.
 */
const groupRequests = { findOne: vi.fn(), save: vi.fn((v) => v) };
const audit = { log: vi.fn() };

function servicio(): ReservationsService {
  const vacio = {} as never;
  return new ReservationsService(
    vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio,
    vacio, vacio, audit as never, vacio, vacio, groupRequests as never, vacio, vacio, vacio,
  );
}

const solicitud = () => ({
  id: 'g-1', formId: 'form-1', guestName: 'Ana', guestEmail: 'ana@example.cl', guestPhone: '+56912345678',
  partySize: 14, eventType: 'cumpleanos', notes: 'Torta propia', status: 'contacted',
  details: { answers: { comoNosConociste: 'Instagram' }, resourceId: 'terraza', dietaryNotes: 'Dos celíacos' },
});

describe('convertir una solicitud de grupo en reserva', () => {
  beforeEach(() => vi.clearAllMocks());

  it('crea la reserva con los datos de la solicitud y la marca como convertida', async () => {
    groupRequests.findOne.mockResolvedValue(solicitud());
    const service = servicio();
    const createManual = vi.spyOn(service, 'createManual').mockResolvedValue({ id: 'res-9' } as never);

    await service.convertGroupRequest('org-1', 'g-1', { startsAt: '2026-10-03T23:00:00.000Z' }, 'user-1');

    expect(createManual).toHaveBeenCalledWith('org-1', 'user-1', expect.objectContaining({
      formId: 'form-1', guestName: 'Ana', guestEmail: 'ana@example.cl', partySize: 14, resourceId: 'terraza',
      answers: expect.objectContaining({ comoNosConociste: 'Instagram', groupEventType: 'cumpleanos', groupEventNotes: 'Torta propia', dietaryNotes: 'Dos celíacos' }),
    }), undefined, undefined);
    expect(groupRequests.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'converted', details: expect.objectContaining({ reservationId: 'res-9' }) }));
  });

  it('la zona elegida al convertir manda sobre la que pidió la persona', async () => {
    groupRequests.findOne.mockResolvedValue(solicitud());
    const service = servicio();
    const createManual = vi.spyOn(service, 'createManual').mockResolvedValue({ id: 'res-9' } as never);
    await service.convertGroupRequest('org-1', 'g-1', { startsAt: '2026-10-03T23:00:00.000Z', resourceId: 'salon' }, 'user-1');
    expect(createManual.mock.calls[0][2]).toEqual(expect.objectContaining({ resourceId: 'salon' }));
  });

  it('no convierte dos veces la misma solicitud', async () => {
    groupRequests.findOne.mockResolvedValue({ ...solicitud(), status: 'converted' });
    const service = servicio();
    const createManual = vi.spyOn(service, 'createManual');
    await expect(service.convertGroupRequest('org-1', 'g-1', { startsAt: '2026-10-03T23:00:00.000Z' }, 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(createManual).not.toHaveBeenCalled();
  });
});
