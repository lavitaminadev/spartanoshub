import { describe, expect, it, vi } from 'vitest';
import { CampaignsService } from '../../../src/modules/crm/campaigns/campaigns.service';

function servicio(campanias: Array<Record<string, unknown>> = [], conteos: Array<{ name: string; total: string }> = []) {
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
  const sources = { create: vi.fn().mockImplementation((value) => value) };
  const ingest = { issueToken: vi.fn().mockResolvedValue({ source: {}, token: 'lk_secreta' }) };

  return {
    service: new CampaignsService(campaigns as never, leads as never, sources as never, ingest as never),
    sources,
    ingest,
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
});
