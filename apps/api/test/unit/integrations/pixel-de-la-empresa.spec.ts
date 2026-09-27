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
  /*
   * El doble responde con la lista entera, como el repositorio de verdad.
   *
   * La comprobación pasó de `findOne` a `find` porque con `findOne` el resultado dependía del
   * orden del índice cuando un Pixel figuraba en dos empresas: fallaba unas veces sí y otras no
   * sobre la misma. Se acepta una lista de dueños para poder probar justo ese caso.
   */
  const servicio = (duenios: string | null | string[]) => {
    const lista = duenios === null ? [] : (Array.isArray(duenios) ? duenios : [duenios])
      .map((clientId, indice) => ({ id: `p${indice}`, clientId }));
    const pixeles = { find: vi.fn().mockResolvedValue(lista) };
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

  /*
   * El caso que se veía en producción y que dependía del azar.
   *
   * Un Pixel arrastrado desde antes de esta regla figura en dos empresas a la vez. Con `findOne`
   * el resultado cambiaba según qué fila devolviera el índice: la empresa que sí lo tiene
   * asignado recibía «es de otra empresa» unas veces sí y otras no, y cambiarle el dueño no
   * servía de nada porque la otra fila seguía ahí.
   */
  it('acepta a la empresa que lo tiene, aunque otra figure con el mismo Pixel', async () => {
    await expect(servicio(['empresa-2', 'empresa-1']).assertPixelDeLaEmpresa('org-1', 'empresa-1', '123'))
      .resolves.toBeUndefined();
    // Y al revés: el orden de las filas no puede cambiar la respuesta.
    await expect(servicio(['empresa-1', 'empresa-2']).assertPixelDeLaEmpresa('org-1', 'empresa-1', '123'))
      .resolves.toBeUndefined();
  });

  it('sigue rechazando cuando ninguna de las dueñas es la que pregunta', async () => {
    await expect(servicio(['empresa-2', 'empresa-3']).assertPixelDeLaEmpresa('org-1', 'empresa-1', '123'))
      .rejects.toThrow(BadRequestException);
  });
});
