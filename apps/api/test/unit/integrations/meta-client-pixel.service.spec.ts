import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MetaClientPixelService } from '../../../src/modules/integrations/meta/meta-client-pixel.service';

describe('MetaClientPixelService', () => {
  /**
   * Última integración devuelta o creada, para que la relectura con bloqueo encuentre lo
   * mismo que encontraría en base.
   *
   * El servicio escribe el mapa de Pixeles dentro de una transacción que vuelve a leer la
   * fila: sin este seguimiento, la relectura devolvería `null` y ninguna configuración
   * llegaría a guardarse.
   */
  let stored: { id?: string; config?: Record<string, unknown> } | null = null;

  const integrations = {
    findOne: vi.fn(),
    create: vi.fn((value) => value),
    save: vi.fn(async (value) => { stored = value; return value; }),
    // La transacción se ejecuta en el acto y entrega el mismo repositorio: lo que se busca
    // verificar es el contenido que queda escrito, no el aislamiento de MySQL.
    manager: {
      transaction: vi.fn(async (run: (manager: unknown) => Promise<unknown>) => run({
        getRepository: () => ({
          findOne: vi.fn(async () => stored),
          save: vi.fn(async (value: unknown) => { stored = value as typeof stored; return value; }),
        }),
      })),
    },
  };
  const clients = { find: vi.fn(), findOne: vi.fn() };
  const pixels = { validatePixel: vi.fn() };
  let service: MetaClientPixelService;

  /** Fija la integración que verán tanto la búsqueda inicial como la relectura con bloqueo. */
  const givenIntegration = (integration: { id?: string; config?: Record<string, unknown> } | null) => {
    stored = integration;
    integrations.findOne.mockResolvedValue(integration);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    stored = null;
    delete process.env.META_CONVERSIONS_ACCESS_TOKEN;
    service = new MetaClientPixelService(integrations as never, clients as never, pixels as never);
  });

  it('resolves only the Pixel and token explicitly assigned to the requested client', async () => {
    givenIntegration({
      config: { clientPixels: {
        'client-a': { pixelId: '111', pixelName: 'Pixel Principal', accessToken: 'token-a', configuredAt: '2026-07-20' },
        'client-b': { pixelId: '222', accessToken: 'token-b', configuredAt: '2026-07-20' },
      } },
    });
    await expect(service.resolve('org-1', 'client-a')).resolves.toEqual({ pixelId: '111', pixelName: 'Pixel Principal', accessToken: 'token-a' });
    await expect(service.resolve('org-1', 'client-missing')).resolves.toEqual({ pixelId: '', pixelName: null, accessToken: undefined });
  });

  it('validates ownership and Pixel before persisting a client mapping', async () => {
    const integration = { config: {} };
    givenIntegration(integration);
    clients.findOne.mockResolvedValue({ id: 'client-a', name: 'Cliente A' });
    pixels.validatePixel.mockResolvedValue(true);
    const result = await service.configure('integration-1', 'org-1', 'client-a', '123456', 'a-valid-access-token-for-meta', 'Reservas Cliente A');
    expect(result).toMatchObject({ clientId: 'client-a', pixelId: '123456', pixelName: 'Reservas Cliente A', tokenConfigured: true });
    expect(integration.config).toHaveProperty('clientPixels.client-a.pixelId', '123456');
    expect(integration.config).toHaveProperty('clientPixels.client-a.pixelName', 'Reservas Cliente A');
    expect(JSON.stringify(integration.config)).not.toContain('a-valid-access-token-for-meta');
  });

  it('configures a direct CAPI Pixel without requiring Meta OAuth', async () => {
    givenIntegration(null);
    clients.findOne.mockResolvedValue({ id: 'client-a', name: 'Cliente A' });
    pixels.validatePixel.mockResolvedValue(true);
    const result = await service.setup('org-1', 'client-a', 'manual', {
      pixelId: '123456',
      pixelName: 'Pixel Manual',
      accessToken: 'a-valid-access-token-for-meta',
    });
    expect(integrations.create).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      name: 'Meta CAPI',
      status: 'pending',
    }));
    expect(result).toMatchObject({ clientId: 'client-a', pixelId: '123456', pixelName: 'Pixel Manual', tokenConfigured: true });
  });

  it('no pierde el Pixel de otro cliente configurado entre la lectura y la escritura', async () => {
    // La integración que el servicio ve al empezar: todavía sin el Pixel de `client-a`.
    const stale = { id: 'integration-1', config: { clientPixels: {} as Record<string, unknown> } };
    integrations.findOne.mockResolvedValue(stale);

    // Lo que hay realmente en base al momento de escribir, porque otra configuración
    // simultánea ya guardó el suyo. La relectura con bloqueo debe partir de acá.
    stored = { id: 'integration-1', config: { clientPixels: {
      'client-a': { pixelId: '111', pixelName: 'Pixel A', accessToken: 'token-a', configuredAt: '2026-08-01' },
    } } };

    clients.findOne.mockResolvedValue({ id: 'client-b', name: 'Cliente B' });
    pixels.validatePixel.mockResolvedValue(true);

    await service.configure('integration-1', 'org-1', 'client-b', '222', 'a-valid-access-token-for-meta', 'Pixel B');

    const saved = (stored as { config: { clientPixels: Record<string, { pixelId: string }> } }).config.clientPixels;
    expect(saved['client-b'].pixelId).toBe('222');
    // Lo que importa: el Pixel del otro cliente sigue ahí. Antes se leía el mapa vacío del
    // objeto obsoleto y al guardar se lo llevaba por delante, sin error y sin aviso.
    expect(saved['client-a'].pixelId).toBe('111');
  });

  it('reuses an existing organization Pixel only after an explicit selection', async () => {
    const integration = { config: { clientPixels: {
      'client-a': { pixelId: '999', pixelName: 'Pixel Compartido', accessToken: 'protected-token', configuredAt: '2026-07-20' },
    } } };
    givenIntegration(integration);
    clients.findOne.mockResolvedValue({ id: 'client-b', name: 'Cliente B' });
    const result = await service.setup('org-1', 'client-b', 'existing', { existingPixelId: '999' });
    expect(result).toMatchObject({ clientId: 'client-b', pixelId: '999', pixelName: 'Pixel Compartido', tokenConfigured: true });
    expect(integration.config.clientPixels['client-b'].accessToken).toBe('protected-token');
    expect(integration.config.clientPixels['client-b'].pixelName).toBe('Pixel Compartido');
    expect(pixels.validatePixel).not.toHaveBeenCalled();
  });
});
