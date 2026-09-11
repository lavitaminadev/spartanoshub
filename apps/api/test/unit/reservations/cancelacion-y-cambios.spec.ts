import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';

/**
 * Lo que devuelve y lo que cambia una reserva desde su enlace de gestión.
 *
 * El cupón se descontaba al reservar y nunca volvía, así que uno de diez usos se agotaba con
 * diez reservas aunque nueve se hubieran cancelado. Y el enlace solo dejaba mover la hora:
 * «éramos cuatro, ahora seis» obligaba a cancelar y reservar de nuevo.
 */
const updateQuery = { update: vi.fn(), set: vi.fn(), where: vi.fn(), execute: vi.fn().mockResolvedValue({ affected: 1 }) };
updateQuery.update.mockReturnValue(updateQuery);
updateQuery.set.mockReturnValue(updateQuery);
updateQuery.where.mockReturnValue(updateQuery);

function servicio(): ReservationsService {
  const vacio = {} as never;
  return new ReservationsService(
    vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio,
    vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio, vacio,
  );
}

describe('devolver el cupón al cancelar', () => {
  beforeEach(() => vi.clearAllMocks());

  const manager = { getRepository: () => ({ createQueryBuilder: () => updateQuery }) };
  const devolver = (booking: unknown) => (servicio() as unknown as { devolverCupon: (m: unknown, b: unknown) => Promise<void> }).devolverCupon(manager, booking);

  it('descuenta un uso sin bajar de cero', async () => {
    await devolver({ organizationId: 'org-1', couponCode: 'VERANO10' });
    expect(updateQuery.where).toHaveBeenCalledWith('organization_id = :org AND code = :code', { org: 'org-1', code: 'VERANO10' });
    const set = updateQuery.set.mock.calls[0][0] as { usageCount: () => string };
    expect(set.usageCount()).toBe('GREATEST(usage_count - 1, 0)');
  });

  it('no toca nada si la reserva no usó cupón', async () => {
    await devolver({ organizationId: 'org-1', couponCode: null });
    expect(updateQuery.execute).not.toHaveBeenCalled();
  });
});
