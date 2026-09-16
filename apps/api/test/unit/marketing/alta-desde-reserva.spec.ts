import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AltaDeSuscriptorDesdeReserva } from '../../../src/modules/marketing/alta-desde-reserva';
import { EstadoDeSuscripcion } from '../../../src/modules/marketing/suscriptor.entity';

/**
 * Aceptar «quiero beneficios» tiene que tener una consecuencia, y sólo aceptarlo.
 *
 * La lista se llenaba importando un archivo a mano, así que el saludo de cumpleaños no le llegaba
 * a nadie que hubiera reservado por más que su fecha estuviera guardada. Y una dirección que entra
 * sin que su dueño lo haya pedido no es una lista: es un problema de los caros.
 */
describe('alta en la lista de correo desde una reserva', () => {
  const suscriptores = { findOne: vi.fn(), save: vi.fn(async (fila) => fila), create: vi.fn((fila) => fila) };
  let alta: AltaDeSuscriptorDesdeReserva;

  const datos = {
    organizationId: 'org-1',
    clientId: 'client-1',
    email: ' Camila@Correo.CL ',
    name: 'Camila Rojas',
    birthDate: '1990-05-14',
    origen: 'Casa Costanera',
    consentText: 'Quiero beneficios y novedades de Casa Costanera.',
    consentAt: new Date('2026-09-16T12:00:00Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    alta = new AltaDeSuscriptorDesdeReserva(suscriptores as never);
  });

  it('crea la ficha con el texto aceptado y la fecha de nacimiento', async () => {
    suscriptores.findOne.mockResolvedValue(null);

    await alta.registrar(datos);

    expect(suscriptores.save).toHaveBeenCalledWith(expect.objectContaining({
      email: 'camila@correo.cl',
      status: EstadoDeSuscripcion.SUSCRITO,
      consentText: datos.consentText,
      source: 'reserva',
      sourceDetail: 'Casa Costanera',
    }));
    expect(suscriptores.save.mock.calls[0][0].birthDate.toISOString().slice(0, 10)).toBe('1990-05-14');
    expect(suscriptores.save.mock.calls[0][0].unsubscribeToken).toBeTruthy();
  });

  it('sin correo no hace nada: no hay a quién escribirle', async () => {
    await alta.registrar({ ...datos, email: '   ' });
    expect(suscriptores.save).not.toHaveBeenCalled();
  });

  it('no revierte una baja: es definitiva', async () => {
    suscriptores.findOne.mockResolvedValue({ status: EstadoDeSuscripcion.BAJA, birthDate: null, name: null });

    await alta.registrar(datos);

    expect(suscriptores.save.mock.calls[0][0].status).toBe(EstadoDeSuscripcion.BAJA);
  });

  it('a quien ya está sólo le completa los huecos', async () => {
    suscriptores.findOne.mockResolvedValue({ status: EstadoDeSuscripcion.SUSCRITO, birthDate: null, name: 'Camila R.' });

    await alta.registrar(datos);

    const guardado = suscriptores.save.mock.calls[0][0];
    expect(guardado.name).toBe('Camila R.');
    expect(guardado.birthDate.toISOString().slice(0, 10)).toBe('1990-05-14');
  });

  it('un fallo al escribir la lista no se propaga: la reserva ya está hecha', async () => {
    suscriptores.findOne.mockRejectedValue(new Error('base caída'));
    await expect(alta.registrar(datos)).resolves.toBeUndefined();
  });
});
