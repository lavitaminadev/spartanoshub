import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaClientPixelService } from '../../../src/modules/integrations/meta/meta-client-pixel.service';

/**
 * De qué empresa sale el token con el que se escribe en un Pixel.
 *
 * Antes se recorrían las credenciales de todas las empresas de la organización y se tomaba la
 * primera que usara ese Pixel, así que **cuál se usaba dependía del orden de las claves en un
 * JSON**. Con dos empresas compartiendo destino funciona por casualidad; el día que una revoque su
 * token, la otra deja de enviar sin que nada lo explique.
 */
describe('el token no se toma de otra empresa', () => {
  let guardado: Record<string, unknown> | null = null;

  const servicio = () => {
    const integrations = {
      findOne: vi.fn(async () => guardado),
      save: vi.fn(async (v: unknown) => v),
      manager: { transaction: vi.fn() },
    };
    return new MetaClientPixelService(
      integrations as never,
      { find: vi.fn().mockResolvedValue([]) } as never,
      // La tabla, vacía: estas pruebas describen la regla dentro del JSON, que es la red mientras
      // conviven las dos formas. La tabla tiene las suyas aparte.
      { findOne: vi.fn().mockResolvedValue(null) } as never,
      { verificarPixel: vi.fn() } as never,
    );
  };

  beforeEach(() => {
    guardado = null;
    delete process.env.META_CONVERSIONS_ACCESS_TOKEN;
  });

  it('con dos empresas en el mismo Pixel, cada una usa el suyo', async () => {
    guardado = {
      id: 'int-1',
      config: {
        clientPixels: {
          'empresa-a': { pixelId: '911', accessToken: 'token-de-a', configuredAt: 'x' },
          'empresa-b': { pixelId: '911', accessToken: 'token-de-b', configuredAt: 'x' },
        },
      },
    };

    const a = await servicio().resolveForScope('org-1', 'empresa-a', '911');
    const b = await servicio().resolveForScope('org-1', 'empresa-b', '911');

    expect(a.accessToken).toBe('token-de-a');
    expect(b.accessToken).toBe('token-de-b');
  });

  /*
   * El registro por Pixel es la credencial declarada para ese destino y no pertenece a ninguna
   * empresa: cuando existe, manda sobre lo que hubiera quedado dentro de una.
   */
  it('el registro por Pixel gana sobre lo guardado dentro de una empresa', async () => {
    guardado = {
      id: 'int-1',
      config: {
        metaPixels: { 911: { name: 'GRDS', accessToken: 'token-del-registro', updatedAt: 'x' } },
        clientPixels: { 'empresa-a': { pixelId: '911', accessToken: 'token-de-a', configuredAt: 'x' } },
      },
    };

    await expect(servicio().resolveByPixel('org-1', '911')).resolves.toBe('token-del-registro');
  });

  /*
   * El envío desde la cola llega sin empresa: solo tiene organización y Pixel. Exigirla dejaría
   * sin credencial a todo lo configurado antes de que existiera el registro por Pixel.
   */
  it('sin empresa, si solo una la tiene, esa se usa', async () => {
    guardado = {
      id: 'int-1',
      config: {
        clientPixels: {
          'empresa-a': { pixelId: '911', accessToken: 'token-de-a', configuredAt: 'x' },
          'empresa-b': { pixelId: '222', accessToken: 'token-de-b', configuredAt: 'x' },
        },
      },
    };

    await expect(servicio().resolveByPixel('org-1', '911')).resolves.toBe('token-de-a');
  });

  /*
   * Y si la tienen dos, no se elige: quedarse con una sería volver a depender del orden del JSON.
   * Sin credencial el evento falla con un motivo legible, que es preferible a enviarlo con la
   * credencial de otro anunciante.
   */
  it('sin empresa y con dos candidatas, no se elige ninguna', async () => {
    guardado = {
      id: 'int-1',
      config: {
        clientPixels: {
          'empresa-a': { pixelId: '911', accessToken: 'token-de-a', configuredAt: 'x' },
          'empresa-b': { pixelId: '911', accessToken: 'token-de-b', configuredAt: 'x' },
        },
      },
    };

    await expect(servicio().resolveByPixel('org-1', '911')).resolves.toBeUndefined();
  });
});
