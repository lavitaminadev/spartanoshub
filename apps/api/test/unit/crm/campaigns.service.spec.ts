import { describe, expect, it, vi } from 'vitest';
import { CampaignsService } from '../../../src/modules/crm/campaigns/campaigns.service';

function servicio(
  campanias: Array<Record<string, unknown>> = [],
  conteos: Array<{ name: string; total: string }> = [],
  source: Record<string, unknown> | null = null,
) {
  const campaigns = {
    find: vi.fn().mockResolvedValue(campanias),
    save: vi.fn().mockImplementation(async (value) => ({ id: 'camp-1', ...value })),
    create: vi.fn().mockImplementation((value) => value),
    delete: vi.fn().mockResolvedValue({ affected: 1 }),
    findOne: vi.fn().mockResolvedValue(campanias[0] ?? null),
  };
  const leads = {
    createQueryBuilder: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue(conteos),
    }),
  };
  const sources = {
    create: vi.fn().mockImplementation((value) => value),
    findOne: vi.fn().mockResolvedValue(source),
    save: vi.fn().mockImplementation(async (value) => value),
  };
  const ingest = { issueToken: vi.fn().mockResolvedValue({ source: {}, token: 'lk_secreta' }) };
  // El Pixel de una campaña pasa por la misma puerta que el de un local: de quién es, y si
  // tiene con qué escribir. Por defecto el doble acepta, y cada prueba ajusta lo que necesita.
  const clientPixels = {
    assertPixelDeLaEmpresa: vi.fn().mockResolvedValue(undefined),
    resolveForScope: vi.fn().mockResolvedValue({ accessToken: 'token' }),
  };

  return {
    service: new CampaignsService(campaigns as never, leads as never, sources as never, ingest as never, clientPixels as never),
    sources,
    ingest,
    clientPixels,
    campaigns,
  };
}

describe('CampaignsService · costo por lead', () => {
  it('divide la inversión entre los leads que declararon esa campaña', async () => {
    const { service } = servicio(
      [{ id: 'c1', name: 'Verano', source: 'Meta Ads', investment: '300000', status: 'active', clientId: null }],
      [{ name: 'Verano', total: '12' }],
    );

    const [campania] = await service.list('org-1');

    expect(campania.leads).toBe(12);
    expect(campania.costPerLead).toBe(25000);
  });

  it('deja el costo por lead en null mientras no llegue ninguno', async () => {
    const { service } = servicio(
      [{ id: 'c1', name: 'Verano', source: 'Meta Ads', investment: '300000', status: 'active', clientId: null }],
      [],
    );

    const [campania] = await service.list('org-1');

    // Cero diría que salieron gratis; lo que ocurre es que no hay con qué dividir.
    expect(campania.leads).toBe(0);
    expect(campania.costPerLead).toBeNull();
  });
});

describe('CampaignsService · la llave nace atada a su campaña', () => {
  it('emite una llave con la cuenta y la campaña de la campaña creada', async () => {
    const { service, sources, ingest } = servicio();

    const { token } = await service.create('org-1', { name: '  Verano  ', clientId: 'client-1' }, 'user-1');

    expect(token).toBe('lk_secreta');
    // Es lo que hace que Make no pueda equivocarse: el lead pertenece a la cuenta y a la
    // campaña de la llave, no a lo que venga escrito en el cuerpo.
    expect(sources.create).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1',
      clientId: 'client-1',
      campaignName: 'Verano',
      isActive: true,
    }));
    expect(ingest.issueToken).toHaveBeenCalledTimes(1);
  });

  it('la campaña de la agencia emite su llave sin cuenta', async () => {
    const { service, sources } = servicio();

    await service.create('org-1', { name: 'Prospección propia' });

    expect(sources.create).toHaveBeenCalledWith(expect.objectContaining({ clientId: null, campaignName: 'Prospección propia' }));
  });

  it('mantiene la llave vinculada cuando cambia el nombre o la empresa', async () => {
    const source = { id: 'source-1', campaignId: 'c1', campaignName: 'Antes', clientId: 'client-1', isActive: true };
    const { service, sources } = servicio(
      [{ id: 'c1', name: 'Antes', source: 'meta_lead_ads', clientId: 'client-1', status: 'active' }],
      [],
      source,
    );

    await service.update('c1', 'org-1', { name: 'Después', clientId: 'client-2', status: 'paused' });

    expect(sources.save).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: 'c1', campaignName: 'Después', clientId: 'client-2', isActive: false,
    }));
  });

  it('apaga la llave antes de eliminar la campaña', async () => {
    const source = { id: 'source-1', campaignId: 'c1', campaignName: 'Verano', isActive: true };
    const { service, sources } = servicio(
      [{ id: 'c1', name: 'Verano', source: 'meta_lead_ads', clientId: null, status: 'active' }],
      [],
      source,
    );

    await service.remove('c1', 'org-1');

    expect(sources.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
  });
});

/*
 * El Pixel de una campaña pasa por la misma puerta que el de un local de Reservas.
 *
 * La pantalla dejaba escribir el número a mano y el servidor lo guardaba tal cual: por el CRM se
 * podía medir sobre el Pixel de otra empresa —mezclando las conversiones de dos negocios en el
 * mismo Events Manager— y guardar uno sin credencial, con lo que la campaña quedaba marcada como
 * que reporta y cada evento moría en el envío.
 */
describe('CampaignsService · el Pixel de la campaña', () => {
  const nueva = { name: 'Verano', clientId: 'cliente-1', metaPixelId: '999' } as never;

  it('rechaza el Pixel de otra empresa', async () => {
    const { service, clientPixels, campaigns } = servicio();
    clientPixels.assertPixelDeLaEmpresa.mockRejectedValue(new Error('El Pixel 999 es de otra empresa'));

    await expect(service.create('org-1', nueva)).rejects.toThrow(/es de otra empresa/);
    expect(campaigns.save).not.toHaveBeenCalled();
  });

  it('rechaza un Pixel sin token de Conversions API, en vez de dejarlo fallando en silencio', async () => {
    const { service, clientPixels, campaigns } = servicio();
    clientPixels.resolveForScope.mockResolvedValue({ accessToken: undefined });

    await expect(service.create('org-1', nueva)).rejects.toThrow(/no tiene token de Conversions API/);
    expect(campaigns.save).not.toHaveBeenCalled();
  });

  it('acepta el Pixel propio con credencial', async () => {
    const { service, clientPixels } = servicio();

    await expect(service.create('org-1', nueva)).resolves.toMatchObject({ campaign: { metaPixelId: '999' } });
    expect(clientPixels.assertPixelDeLaEmpresa).toHaveBeenCalledWith('org-1', 'cliente-1', '999');
  });

  /* Heredar el de la empresa no se comprueba: ese Pixel ya pasó por aquí al asignárselo a ella. */
  it('heredar el de la empresa no consulta nada', async () => {
    const { service, clientPixels } = servicio();

    await service.create('org-1', { name: 'Verano', clientId: 'cliente-1' } as never);

    expect(clientPixels.assertPixelDeLaEmpresa).not.toHaveBeenCalled();
    expect(clientPixels.resolveForScope).not.toHaveBeenCalled();
  });

  /*
   * Una campaña vieja con un Pixel ya irregular no se queda atascada: revalidar en cada guardado
   * haría fallar la corrección de la inversión por algo que no se está editando.
   */
  it('al editar otra cosa no se revisa el Pixel', async () => {
    const { service, clientPixels } = servicio([{ id: 'c1', name: 'Verano', clientId: 'cliente-1', metaPixelId: '999' }]);

    // La pantalla manda el formulario entero, incluidos empresa y Pixel sin cambios.
    await service.update('c1', 'org-1', { name: 'Verano', investment: 5000, clientId: 'cliente-1', metaPixelId: '999' } as never);

    expect(clientPixels.assertPixelDeLaEmpresa).not.toHaveBeenCalled();
  });

  /* Cambiar de empresa mueve el Pixel a otro dueño aunque el número no se toque. */
  it('cambiar la empresa sí vuelve a revisar el Pixel que queda', async () => {
    const { service, clientPixels } = servicio([{ id: 'c1', name: 'Verano', clientId: 'cliente-1', metaPixelId: '999' }]);

    await service.update('c1', 'org-1', { name: 'Verano', clientId: 'cliente-2' } as never);

    expect(clientPixels.assertPixelDeLaEmpresa).toHaveBeenCalledWith('org-1', 'cliente-2', '999');
  });
});
