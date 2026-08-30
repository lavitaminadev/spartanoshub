import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IsNull } from 'typeorm';
import { MetaClientPixelService } from '../../../src/modules/integrations/meta/meta-client-pixel.service';

/**
 * La credencial de un Pixel, leída de su tabla.
 *
 * Lo que estas pruebas fijan no es que la tabla funcione, sino **con qué criterio se consulta**:
 * la fila de esa empresa, o la del registro que no pertenece a ninguna. Nunca la de otra empresa,
 * y no porque alguien se acuerde de filtrar sino porque la consulta no puede devolverla.
 *
 * Y que el JSON sigue siendo la red: sin fila, se busca donde estaba. Eso es lo que permite
 * desplegar la tabla sin que lo ya configurado deje de enviar.
 */
describe('credenciales de Pixel en tabla', () => {
  let filas: Array<Record<string, unknown>> = [];
  let json: Record<string, unknown> | null = null;

  const servicio = () => {
    const pixelesGuardados = {
      /** Doble mínimo del repositorio: compara las condiciones que el servicio realmente usa. */
      findOne: vi.fn(async ({ where }: { where: Record<string, unknown> }) => filas.find((fila) => (
        fila.organizationId === where.organizationId
        && fila.pixelId === where.pixelId
        && (where.clientId === IsNull() || String(where.clientId) === String(IsNull())
          ? fila.clientId === null
          : fila.clientId === where.clientId)
      )) ?? null),
    };

    return new MetaClientPixelService(
      { findOne: vi.fn(async () => json), save: vi.fn(), manager: { transaction: vi.fn() } } as never,
      { find: vi.fn().mockResolvedValue([]) } as never,
      pixelesGuardados as never,
      { verificarPixel: vi.fn() } as never,
    );
  };

  beforeEach(() => {
    filas = [];
    json = null;
    delete process.env.META_CONVERSIONS_ACCESS_TOKEN;
  });

  it('usa la credencial de la empresa que pide', async () => {
    filas = [
      { organizationId: 'org-1', clientId: 'empresa-a', pixelId: '911', accessToken: 'de-a' },
      { organizationId: 'org-1', clientId: 'empresa-b', pixelId: '911', accessToken: 'de-b' },
    ];

    const resultado = await servicio().resolveForScope('org-1', 'empresa-b', '911');

    expect(resultado.accessToken).toBe('de-b');
  });

  /*
   * El registro sin empresa describe el destino, no a quién lo usa: es la credencial declarada
   * para ese Pixel, y cubre a las empresas que no tienen una propia.
   */
  it('sin credencial propia recurre a la del registro, no a la de otra empresa', async () => {
    filas = [
      { organizationId: 'org-1', clientId: null, pixelId: '911', accessToken: 'del-registro' },
      { organizationId: 'org-1', clientId: 'empresa-a', pixelId: '911', accessToken: 'de-a' },
    ];

    const resultado = await servicio().resolveForScope('org-1', 'empresa-b', '911');

    expect(resultado.accessToken).toBe('del-registro');
    expect(resultado.accessToken).not.toBe('de-a');
  });

  it('la propia gana sobre la del registro', async () => {
    filas = [
      { organizationId: 'org-1', clientId: null, pixelId: '911', accessToken: 'del-registro' },
      { organizationId: 'org-1', clientId: 'empresa-a', pixelId: '911', accessToken: 'de-a' },
    ];

    await expect(servicio().resolveForScope('org-1', 'empresa-a', '911'))
      .resolves.toMatchObject({ accessToken: 'de-a' });
  });

  /*
   * La razón de que el despliegue sea seguro: lo configurado antes de la tabla se sigue
   * encontrando donde estaba, así que aunque la copia fallara nada dejaría de enviarse.
   */
  it('sin fila en la tabla cae al JSON de siempre', async () => {
    json = {
      id: 'int-1',
      config: { clientPixels: { 'empresa-a': { pixelId: '911', accessToken: 'viejo', configuredAt: 'x' } } },
    };

    await expect(servicio().resolveByPixel('org-1', '911')).resolves.toBe('viejo');
  });

  it('una organización no ve la credencial de otra', async () => {
    filas = [{ organizationId: 'org-2', clientId: 'empresa-a', pixelId: '911', accessToken: 'de-otra-org' }];

    await expect(servicio().resolveByPixel('org-1', '911')).resolves.toBeUndefined();
  });
});
