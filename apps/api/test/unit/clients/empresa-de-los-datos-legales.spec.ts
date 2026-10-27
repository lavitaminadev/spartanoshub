/**
 * De qué empresa son los datos legales que se están guardando.
 *
 * Es el caso en que elegir mal la empresa deja constancia de lo contrario de lo que pasó. Entre
 * esos datos está la **aceptación del contrato de encargo**: quién aceptó, cuándo, con qué versión
 * y por qué empresa. Reservas y Encuestas lo exponen bajo rutas propias y cada una resolvía la
 * empresa por su cuenta, con el mismo criterio: una cuenta de portal usaba siempre la de su
 * sesión. Con un local acertaba; con dos, quien atiende Centro y Providencia declaraba Providencia
 * y la aceptación quedaba anotada en Centro.
 *
 * Resolverlo en un solo sitio es lo que impide que los dos módulos se vuelvan a separar: la
 * primera vez ya se separaron.
 */

import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { empresaDeLosDatosLegales } from '../../../src/modules/clients/datos-legales-de-empresa';

const PORTAL = { id: 'u1', role: 'client', clientId: 'centro', organizationId: 'org-1' } as never;
const INTERNO = { id: 'u2', role: 'community_manager', organizationId: 'org-1' } as never;

function alcance(alcanzables: string[] | undefined) {
  return {
    allowedClientIds: vi.fn().mockResolvedValue(alcanzables),
    assertClient: vi.fn(async (_org: string, _user: unknown, clientId: string) => {
      if (alcanzables !== undefined && !alcanzables.includes(clientId)) throw new NotFoundException('Client not found');
    }),
  };
}

describe('la empresa de los datos legales', () => {
  /*
   * El caso que justifica el cambio: antes devolvía «centro» y la aceptación del contrato de
   * Providencia quedaba firmada a nombre de Centro.
   */
  it('una cuenta de portal que atiende dos locales trabaja sobre el que declara', async () => {
    const empresa = await empresaDeLosDatosLegales(alcance(['centro', 'providencia']), 'org-1', PORTAL, 'providencia');
    expect(empresa).toBe('providencia');
  });

  it('sin declarar nada, la cuenta de portal usa la suya', async () => {
    const empresa = await empresaDeLosDatosLegales(alcance(['centro']), 'org-1', PORTAL, undefined);
    expect(empresa).toBe('centro');
  });

  it('una empresa que no alcanza da 404, y no se cambia por la suya', async () => {
    await expect(empresaDeLosDatosLegales(alcance(['centro']), 'org-1', PORTAL, 'ajena'))
      .rejects.toThrow(NotFoundException);
  });

  it('el equipo interno trabaja sobre la que declara', async () => {
    const empresa = await empresaDeLosDatosLegales(alcance(['centro']), 'org-1', INTERNO, 'centro');
    expect(empresa).toBe('centro');
  });

  /*
   * Elegirle una al equipo interno sería escribir datos legales —y una aceptación de contrato—
   * en una empresa que nadie nombró.
   */
  it('al equipo interno no se le elige una empresa en silencio', async () => {
    await expect(empresaDeLosDatosLegales(alcance(['centro']), 'org-1', INTERNO, undefined))
      .rejects.toThrow(BadRequestException);
  });

  it('una cuenta de portal sin empresa asociada no puede tocarlos', async () => {
    const huerfana = { id: 'u3', role: 'client', organizationId: 'org-1' } as never;
    await expect(empresaDeLosDatosLegales(alcance([]), 'org-1', huerfana, undefined))
      .rejects.toThrow(ForbiddenException);
  });

  it('los espacios alrededor no cuentan como empresa declarada', async () => {
    const empresa = await empresaDeLosDatosLegales(alcance(['centro']), 'org-1', PORTAL, '   ');
    expect(empresa).toBe('centro');
  });
});
