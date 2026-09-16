import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PAQUETES_DE_CORREO, PaquetesDeCorreo } from '../../../src/core/parameters/paquetes-de-correo';

/**
 * Contratar un servicio enciende sus avisos, y sólo los que nadie decidió antes.
 *
 * La confirmación de reserva —el comprobante de quien reserva— nacía apagada, así que una empresa
 * podía llevar meses recibiendo reservas sin que su cliente recibiera nada. Encenderlo al
 * contratar es lo que evita ese silencio; respetar lo ya decidido es lo que evita reencender algo
 * que alguien apagó a propósito.
 */
describe('paquetes de correo por servicio contratado', () => {
  const definiciones = { find: vi.fn() };
  const valores = { find: vi.fn(), save: vi.fn(async (filas) => filas), create: vi.fn((fila) => fila) };
  let paquetes: PaquetesDeCorreo;

  beforeEach(() => {
    vi.clearAllMocks();
    paquetes = new PaquetesDeCorreo(definiciones as never, valores as never);
  });

  it('enciende los avisos del servicio recién contratado', async () => {
    definiciones.find.mockResolvedValue([
      { id: 'def-1', key: 'email.reservation_confirmation_enabled' },
      { id: 'def-2', key: 'email.reservation_reminder_enabled' },
    ]);
    valores.find.mockResolvedValue([]);

    const encendidas = await paquetes.encenderPara('client-1', ['reservations']);

    expect(encendidas).toEqual(['email.reservation_confirmation_enabled', 'email.reservation_reminder_enabled']);
    expect(valores.save).toHaveBeenCalledWith([
      expect.objectContaining({ definitionId: 'def-1', scopeId: 'client-1', scopeType: 'client', valueJson: { value: true } }),
      expect.objectContaining({ definitionId: 'def-2', scopeId: 'client-1' }),
    ]);
  });

  it('no reenciende lo que esa empresa ya decidió', async () => {
    definiciones.find.mockResolvedValue([
      { id: 'def-1', key: 'email.reservation_confirmation_enabled' },
      { id: 'def-2', key: 'email.reservation_reminder_enabled' },
    ]);
    // La confirmación tiene valor propio: alguien la apagó, y contratar de nuevo no lo revierte.
    valores.find.mockResolvedValue([{ definitionId: 'def-1' }]);

    const encendidas = await paquetes.encenderPara('client-1', ['reservations']);

    expect(encendidas).toEqual(['email.reservation_reminder_enabled']);
  });

  it('no hace fallar la contratación si el encendido falla', async () => {
    definiciones.find.mockRejectedValue(new Error('base caída'));

    await expect(paquetes.encenderPara('client-1', ['crm'])).resolves.toEqual([]);
  });

  it('la cobranza no pertenece a ningún paquete: va de la agencia hacia la empresa', () => {
    const todas = Object.values(PAQUETES_DE_CORREO).flat();
    expect(todas).not.toContain('email.collection_overdue_enabled');
    expect(todas).toContain('email.reservation_confirmation_enabled');
  });
});
