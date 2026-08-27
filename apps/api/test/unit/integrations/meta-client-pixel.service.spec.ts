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
  const pixels = { verificarPixel: vi.fn(async () => ({ verificado: true, bloquea: false })) };
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
    pixels.verificarPixel.mockResolvedValue({ verificado: true, bloquea: false });
    const result = await service.configure('integration-1', 'org-1', 'client-a', '123456', 'a-valid-access-token-for-meta', 'Reservas Cliente A');
    expect(result).toMatchObject({ clientId: 'client-a', pixelId: '123456', pixelName: 'Reservas Cliente A', tokenConfigured: true });
    expect(integration.config).toHaveProperty('clientPixels.client-a.pixelId', '123456');
    expect(integration.config).toHaveProperty('clientPixels.client-a.pixelName', 'Reservas Cliente A');
    expect(JSON.stringify(integration.config)).not.toContain('a-valid-access-token-for-meta');
  });

  it('configures a direct CAPI Pixel without requiring Meta OAuth', async () => {
    givenIntegration(null);
    clients.findOne.mockResolvedValue({ id: 'client-a', name: 'Cliente A' });
    pixels.verificarPixel.mockResolvedValue({ verificado: true, bloquea: false });
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
    pixels.verificarPixel.mockResolvedValue({ verificado: true, bloquea: false });

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
    expect(pixels.verificarPixel).not.toHaveBeenCalled();
  });
});

/**
 * La credencial pertenece al Pixel, no a la empresa.
 *
 * Es el cambio que arregla tres cosas a la vez: mover una campaña de empresa dejaba la
 * credencial atrás, cambiar un token obligaba a reescribir la asignación, y un Pixel que ninguna
 * empresa usaba todavía no tenía dónde guardar la suya.
 */
describe('MetaClientPixelService · credencial por Pixel', () => {
  let stored: { id?: string; config?: Record<string, any> } | null = null;

  const integrations = {
    findOne: vi.fn(async () => stored),
    create: vi.fn((value) => value),
    save: vi.fn(async (value: any) => { stored = value; return value; }),
    manager: {
      transaction: vi.fn(async (run: (manager: unknown) => Promise<unknown>) => run({
        getRepository: () => ({
          findOne: vi.fn(async () => stored),
          save: vi.fn(async (value: unknown) => { stored = value as typeof stored; return value; }),
        }),
      })),
    },
  };
  const clients = { find: vi.fn(async () => []), findOne: vi.fn() };
  const pixels = { verificarPixel: vi.fn(async () => ({ verificado: true, bloquea: false })) };
  let service: MetaClientPixelService;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.META_CONVERSIONS_ACCESS_TOKEN;
    pixels.verificarPixel.mockResolvedValue({ verificado: true, bloquea: false });
    stored = { id: 'int-1', config: { directCapi: true, clientPixels: {} } };
    service = new MetaClientPixelService(integrations as never, clients as never, pixels as never);
  });

  it('guarda el token bajo el Pixel y lo devuelve al resolver por Pixel', async () => {
    await service.guardarCredencial('org-1', '1011253428584147', { name: 'Principal', accessToken: 'TOKEN-DE-PRUEBA-1234567890' });

    expect(stored?.config?.metaPixels['1011253428584147'].name).toBe('Principal');
    await expect(service.resolveByPixel('org-1', '1011253428584147')).resolves.toBe('TOKEN-DE-PRUEBA-1234567890');
  });

  it('el token no queda en claro en la configuración', async () => {
    await service.guardarCredencial('org-1', '999', { accessToken: 'TOKEN-DE-PRUEBA-1234567890' });

    expect(JSON.stringify(stored?.config)).not.toContain('TOKEN-DE-PRUEBA-1234567890');
  });

  it('sirve el token guardado de la forma antigua, dentro de una empresa', async () => {
    // Lo ya configurado tiene que seguir enviando: si esta lectura fallara, la migración
    // silenciosa dejaría sin credencial a quien no vuelva a guardar.
    stored = { id: 'int-1', config: { clientPixels: { 'cliente-1': { pixelId: '555', accessToken: 'viejo-en-claro', configuredAt: 'x' } } } };

    await expect(service.resolveByPixel('org-1', '555')).resolves.toBe('viejo-en-claro');
  });

  it('renombrar sin token conserva el que ya tenía', async () => {
    await service.guardarCredencial('org-1', '777', { accessToken: 'TOKEN-DE-PRUEBA-1234567890' });
    await service.guardarCredencial('org-1', '777', { name: 'Otro nombre' });

    expect(stored?.config?.metaPixels['777'].name).toBe('Otro nombre');
    await expect(service.resolveByPixel('org-1', '777')).resolves.toBe('TOKEN-DE-PRUEBA-1234567890');
  });

  it('no guarda una credencial que Meta rechaza', async () => {
    // Guardarla en silencio reaparece días después como una cola de eventos fallidos.
    pixels.verificarPixel.mockResolvedValue({ verificado: false, bloquea: true, motivo: 'Invalid OAuth access token' });

    await expect(service.guardarCredencial('org-1', '888', { accessToken: 'TOKEN-DE-PRUEBA-1234567890' }))
      .rejects.toThrow(/rechaz/i);
    expect(stored?.config?.metaPixels).toBeUndefined();
  });

  it('un Pixel sin empresa asignada aparece igual en el catálogo', async () => {
    // Es el que una campaña usa cuando se aparta del Pixel de su empresa: invisible, no habría
    // forma de saber si tiene credencial.
    await service.guardarCredencial('org-1', '1234567890', { name: 'De campaña', accessToken: 'TOKEN-DE-PRUEBA-1234567890' });

    const catalogo = await service.catalog('org-1');
    const registrado = catalogo.pixels.find((pixel) => pixel.pixelId === '1234567890');
    expect(registrado?.usageCount).toBe(0);
    expect(registrado?.tokenConfigured).toBe(true);
  });
});

/**
 * El embudo propio de la agencia mide contra su propio Pixel.
 *
 * Espartanos no es cliente de sí misma: sin un Pixel marcado, su conversión se resolvía contra
 * el de la empresa recién creada y publicaba allí un evento valorado en el retainer que esa
 * empresa le paga.
 */
describe('MetaClientPixelService · Pixel de la agencia', () => {
  let stored: { id?: string; config?: Record<string, any> } | null = null;

  const integrations = {
    findOne: vi.fn(async () => stored),
    create: vi.fn((value) => value),
    save: vi.fn(async (value: any) => { stored = value; return value; }),
    manager: {
      transaction: vi.fn(async (run: (manager: unknown) => Promise<unknown>) => run({
        getRepository: () => ({
          findOne: vi.fn(async () => stored),
          save: vi.fn(async (value: unknown) => { stored = value as typeof stored; return value; }),
        }),
      })),
    },
  };
  const clients = { find: vi.fn(async () => []), findOne: vi.fn() };
  const pixels = { verificarPixel: vi.fn(async () => ({ verificado: true, bloquea: false })) };
  let service: MetaClientPixelService;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.META_CONVERSIONS_ACCESS_TOKEN;
    pixels.verificarPixel.mockResolvedValue({ verificado: true, bloquea: false });
    stored = { id: 'int-1', config: { clientPixels: {} } };
    service = new MetaClientPixelService(integrations as never, clients as never, pixels as never);
  });

  it('sin Pixel marcado no hay destino, que es como queda apagado', async () => {
    await expect(service.resolveAgencia('org-1')).resolves.toEqual({ pixelId: '' });
  });

  it('marcado, devuelve su Pixel y su token', async () => {
    await service.guardarCredencial('org-1', '123456789012345', { accessToken: 'TOKEN-DE-PRUEBA-1234567890' });
    await service.marcarPixelDeAgencia('org-1', '123456789012345');

    await expect(service.resolveAgencia('org-1')).resolves.toEqual({
      pixelId: '123456789012345',
      accessToken: 'TOKEN-DE-PRUEBA-1234567890',
    });
  });

  it('no se puede marcar un Pixel sin token', async () => {
    // Dejaría el embudo propio encolando eventos que Meta rechaza, y el aviso aparecería en la
    // cola en vez de en la pantalla, que es donde todavía se puede corregir.
    await expect(service.marcarPixelDeAgencia('org-1', '999888777666555')).rejects.toThrow(/no tiene token/i);
  });

  it('se puede quitar la marca', async () => {
    await service.guardarCredencial('org-1', '123456789012345', { accessToken: 'TOKEN-DE-PRUEBA-1234567890' });
    await service.marcarPixelDeAgencia('org-1', '123456789012345');
    await service.marcarPixelDeAgencia('org-1', null);

    await expect(service.resolveAgencia('org-1')).resolves.toEqual({ pixelId: '' });
  });
});
