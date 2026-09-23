import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { MetaClientPixelService } from '../../../src/modules/integrations/meta/meta-client-pixel.service';

/**
 * Un local no puede medir en el Pixel de otra empresa.
 *
 * La regla existía al registrarlo en Integraciones, pero no al asignarlo a un local: bastaba
 * escribir el número a mano para que las reservas de una empresa se contaran en el Events Manager
 * de otra.
 */
describe('assertPixelDeLaEmpresa', () => {
  const servicio = (duenio: string | null) => {
    const pixeles = { findOne: vi.fn().mockResolvedValue(duenio === null ? null : { id: 'p', clientId: duenio }) };
    return new MetaClientPixelService({} as never, {} as never, pixeles as never, {} as never);
  };

  it('rechaza el Pixel registrado por otra empresa', async () => {
    await expect(servicio('empresa-2').assertPixelDeLaEmpresa('org-1', 'empresa-1', '123'))
      .rejects.toThrow(BadRequestException);
  });

  it('acepta el suyo', async () => {
    await expect(servicio('empresa-1').assertPixelDeLaEmpresa('org-1', 'empresa-1', '123')).resolves.toBeUndefined();
  });

  it('acepta el de la agencia, que es el que heredan las empresas sin Pixel propio', async () => {
    await expect(servicio(null).assertPixelDeLaEmpresa('org-1', 'empresa-1', '123')).resolves.toBeUndefined();
  });
});
