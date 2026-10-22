/**
 * De qué local son las casillas de aviso que se están repartiendo.
 *
 * Los avisos de Reservas —una reserva nueva, una cancelación— van a correos del equipo del local.
 * Para una cuenta de portal la empresa salía siempre de la sesión, así que quien atiende dos
 * locales abría las casillas del segundo, veía las del primero y guardaba en el primero: los
 * avisos de Providencia acababan llegando al equipo de Centro.
 *
 * Esta pantalla nombra la empresa en `empresa` y no en `clientId`, que es como se llama en el
 * resto de marketing. Por eso la comprobación de alcance y la de servicio contratado se hacen
 * explícitas aquí: el guardia central busca `clientId` y en esta ruta no lo encuentra.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { DestinatariosDeAvisosController } from '../../../src/core/notifications/destinatarios-de-avisos.controller';

const PORTAL = { organizationId: 'org-1', user: { id: 'u1', role: 'client', clientId: 'centro', organizationId: 'org-1' } } as never;
const INTERNO = { organizationId: 'org-1', user: { id: 'u2', role: 'community_manager', organizationId: 'org-1' } } as never;

function montar(alcanzables: string[] | undefined, conReservas: string[] = ['centro', 'providencia']) {
  const destinatarios = { listar: vi.fn().mockResolvedValue([]) };
  const acceso = {
    allowedClientIds: vi.fn().mockResolvedValue(alcanzables),
    assertClient: vi.fn(async (_org: string, _user: unknown, clientId: string) => {
      if (alcanzables !== undefined && !alcanzables.includes(clientId)) throw new NotFoundException('Client not found');
    }),
  };
  const capacidades = {
    assert: vi.fn(async (_org: string, clientId: string) => {
      if (!conReservas.includes(clientId)) throw new ForbiddenException('Sin Reservas contratado');
    }),
  };
  return { controller: new DestinatariosDeAvisosController(destinatarios as never, acceso as never, capacidades as never), destinatarios, capacidades };
}

describe('de qué local son las casillas de aviso', () => {
  it('una cuenta de portal que atiende dos locales reparte las del que declara', async () => {
    const { controller, destinatarios } = montar(['centro', 'providencia']);

    await controller.listar(PORTAL, 'providencia');

    expect(destinatarios.listar).toHaveBeenCalledWith('org-1', 'providencia');
  });

  it('sin declarar nada, la cuenta de portal reparte las suyas', async () => {
    const { controller, destinatarios } = montar(['centro']);

    await controller.listar(PORTAL, undefined);

    expect(destinatarios.listar).toHaveBeenCalledWith('org-1', 'centro');
  });

  /* 404 y no 403: decir «no la alcanzas» ya confirma que existe y que la agencia la atiende. */
  it('un local fuera de alcance da 404, y no se cambia por el suyo', async () => {
    const { controller, destinatarios } = montar(['centro']);

    await expect(controller.listar(PORTAL, 'ajena')).rejects.toThrow(NotFoundException);
    expect(destinatarios.listar).not.toHaveBeenCalled();
  });

  it('al equipo interno no se le elige un local en silencio', async () => {
    const { controller } = montar(['centro']);

    await expect(controller.listar(INTERNO, undefined)).rejects.toThrow(ForbiddenException);
  });

  /*
   * Nombrar el local no concede nada: un local sin Reservas contratado no tiene avisos de
   * Reservas que repartir, y una pantalla escondida no es una puerta cerrada.
   */
  it('un local sin Reservas contratado no reparte avisos, aunque se alcance', async () => {
    const { controller, capacidades } = montar(['centro', 'sin-reservas'], ['centro']);

    await expect(controller.listar(PORTAL, 'sin-reservas')).rejects.toThrow(ForbiddenException);
    expect(capacidades.assert).toHaveBeenCalledWith('org-1', 'sin-reservas', 'reservations');
  });
});
