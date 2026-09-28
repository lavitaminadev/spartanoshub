import { describe, expect, it, vi } from 'vitest';
import { MetaLeadAdsService } from '../../../src/modules/integrations/meta/meta-lead-ads.service';

/** Acceso a la resolución de empresa, que es privada por no ser parte del contrato público. */
function resolver(campanias: Array<Record<string, unknown>>) {
  const campaigns = { find: vi.fn().mockResolvedValue(campanias) };
  const service = new MetaLeadAdsService(
    {} as never, {} as never, campaigns as never, {} as never,
  );
  return {
    llamar: (nombre?: string) => (service as unknown as {
      resolverEmpresa: (org: string, nombre?: string) => Promise<{ clientId?: string; domain: string } | 'ambigua' | null>;
    }).resolverEmpresa('org-1', nombre),
    campaigns,
  };
}

describe('MetaLeadAdsService · de qué empresa es el lead', () => {
  it('una campaña con cliente manda el lead al embudo de ese cliente', async () => {
    const { llamar } = resolver([{ id: 'c1', clientId: 'cliente-9' }]);
    await expect(llamar('Verano Talca')).resolves.toEqual({ clientId: 'cliente-9', domain: 'audience' });
  });

  it('una campaña sin cliente es de la agencia y va al embudo comercial', async () => {
    const { llamar } = resolver([{ id: 'c1', clientId: null }]);
    await expect(llamar('Marca propia')).resolves.toEqual({ domain: 'commercial' });
  });

  it('sin campaña registrada no se guarda nada, en vez de adivinar la empresa', async () => {
    const { llamar } = resolver([]);
    await expect(llamar('Campaña que nadie registró')).resolves.toBeNull();
  });

  it('sin nombre de campaña no se consulta siquiera', async () => {
    const { llamar, campaigns } = resolver([{ id: 'c1' }]);
    await expect(llamar(undefined)).resolves.toBeNull();
    await expect(llamar('   ')).resolves.toBeNull();
    expect(campaigns.find).not.toHaveBeenCalled();
  });

  /*
   * El nombre de campaña no es único por empresa: el índice de `crm_campaigns` no lo exige y
   * «Verano 2026» se repite con facilidad entre clientes. Con `findOne` ganaba la fila que
   * devolviera el índice, así que el mismo lead podía caer en una empresa o en la otra y los
   * contactos de un negocio acababan en la base de otro sin aviso.
   */
  it('con dos campañas del mismo nombre en empresas distintas no elige ninguna', async () => {
    const { llamar } = resolver([{ id: 'c1', clientId: 'cliente-1' }, { id: 'c2', clientId: 'cliente-2' }]);
    await expect(llamar('Verano 2026')).resolves.toBe('ambigua');
  });

  it('dos campañas del mismo nombre y de la misma empresa no son ambiguas', async () => {
    const { llamar } = resolver([{ id: 'c1', clientId: 'cliente-1' }, { id: 'c2', clientId: 'cliente-1' }]);
    await expect(llamar('Verano 2026')).resolves.toEqual({ clientId: 'cliente-1', domain: 'audience' });
  });

  /* Una de la agencia y una de un cliente también es ambigua: son destinos distintos. */
  it('una de la agencia y una de un cliente tampoco se deciden', async () => {
    const { llamar } = resolver([{ id: 'c1', clientId: null }, { id: 'c2', clientId: 'cliente-1' }]);
    await expect(llamar('Verano 2026')).resolves.toBe('ambigua');
  });
});
