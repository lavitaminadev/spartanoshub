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

  /** Nadie pidió no recibir, salvo que una prueba diga lo contrario. */
  const listaDeExclusion = { exclusionDe: vi.fn().mockResolvedValue(null), levantarExclusion: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    listaDeExclusion.exclusionDe.mockResolvedValue(null);
    alta = new AltaDeSuscriptorDesdeReserva(suscriptores as never, listaDeExclusion as never);
  });

  /*
   * Reservar no es pedir publicidad.
   *
   * El articulo 28 B de la Ley 19.496 dice que tras pedir la suspension los envios «quedaran desde
   * entonces prohibidos», sin excepcion por una reserva posterior. Solo una casilla marcada a
   * proposito levanta la exclusion, y eso pasa por otro camino.
   */
  it('no crea ficha a quien pidió no recibir de esta empresa', async () => {
    listaDeExclusion.exclusionDe.mockResolvedValue('local');
    await alta.registrar({ organizationId: 'org-1', clientId: 'c-1', email: 'ana@casa.cl', origen: 'reserva' } as never);
    expect(suscriptores.save).not.toHaveBeenCalled();
    expect(suscriptores.findOne).not.toHaveBeenCalled();
  });

  it('tampoco a quien pidió no recibir de ninguna', async () => {
    listaDeExclusion.exclusionDe.mockResolvedValue('todas');
    await alta.registrar({ organizationId: 'org-1', clientId: 'c-2', email: 'ana@casa.cl', origen: 'reserva' } as never);
    expect(suscriptores.save).not.toHaveBeenCalled();
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
    // Se cuenta como omitida y no como exclusión: no entró, pero no fue porque lo pidiera nadie.
    await expect(alta.registrar(datos)).resolves.toBe('omitida');
  });

  /*
   * Volver después de haberse dado de baja.
   *
   * El permiso nuevo vale —nadie queda excluido de por vida contra su voluntad— pero tiene que ser
   * inequívoco: la pantalla le recuerda que él lo pidió y le pregunta otra vez. Sin ese segundo sí
   * no se toca nada, y por eso el primer intento devuelve qué había pedido en vez de suscribirlo.
   */
  describe('cuando pidió no recibir más', () => {
    it('no lo suscribe ni levanta nada: devuelve el alcance para que se lo recuerden', async () => {
      listaDeExclusion.exclusionDe.mockResolvedValue('local');

      await expect(alta.registrar(datos)).resolves.toBe('local');

      expect(listaDeExclusion.levantarExclusion).not.toHaveBeenCalled();
      expect(suscriptores.save).not.toHaveBeenCalled();
    });

    it('distingue «de este local» de «de ninguno», porque el aviso no dice lo mismo', async () => {
      listaDeExclusion.exclusionDe.mockResolvedValue('todas');
      await expect(alta.registrar(datos)).resolves.toBe('todas');
    });

    it('con el segundo sí levanta la exclusión y lo vuelve a suscribir', async () => {
      listaDeExclusion.exclusionDe.mockResolvedValue('local');
      const ficha = {
        status: EstadoDeSuscripcion.BAJA,
        unsubscribedAt: new Date('2026-01-02T00:00:00Z'),
        unsubscribedScope: 'local',
        consentText: 'el texto viejo',
      };
      suscriptores.findOne.mockResolvedValue(ficha);

      await expect(alta.registrar(datos, true)).resolves.toBe('alta');

      expect(listaDeExclusion.levantarExclusion).toHaveBeenCalledWith('org-1', 'camila@correo.cl', 'client-1');
      expect(ficha.status).toBe(EstadoDeSuscripcion.SUSCRITO);
      expect(ficha.unsubscribedAt).toBeNull();
      expect(ficha.unsubscribedScope).toBeNull();
      // El permiso que vale es el de ahora, no el que dio antes de darse de baja.
      expect(ficha.consentText).toBe(datos.consentText);
      expect(ficha.consentAt).toBe(datos.consentAt);
    });

    it('sin el segundo sí, una baja sigue siendo definitiva aunque vuelva a reservar', async () => {
      suscriptores.findOne.mockResolvedValue({ status: EstadoDeSuscripcion.BAJA, consentText: 'el texto viejo' });

      await expect(alta.registrar(datos)).resolves.toBe('alta');

      expect(suscriptores.save).toHaveBeenCalled();
      expect(suscriptores.save.mock.calls[0][0].status).toBe(EstadoDeSuscripcion.BAJA);
    });
  });
});
