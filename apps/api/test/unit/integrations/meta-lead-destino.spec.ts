import { describe, expect, it, vi } from 'vitest';
import { MetaLeadAdsService } from '../../../src/modules/integrations/meta/meta-lead-ads.service';

/** Acceso a la resolución de empresa, que es privada por no ser parte del contrato público. */
function resolver(campania: Record<string, unknown> | null) {
  const campaigns = { findOne: vi.fn().mockResolvedValue(campania) };
  const service = new MetaLeadAdsService(
    {} as never, {} as never, campaigns as never, {} as never,
  );
  return {
    llamar: (nombre?: string) => (service as unknown as {
      resolverEmpresa: (org: string, nombre?: string) => Promise<{ clientId?: string; domain: string } | null>;
    }).resolverEmpresa('org-1', nombre),
    campaigns,
  };
}

describe('MetaLeadAdsService · de qué empresa es el lead', () => {
  it('una campaña con cliente manda el lead al embudo de ese cliente', async () => {
    const { llamar } = resolver({ id: 'c1', clientId: 'cliente-9' });
    await expect(llamar('Verano Talca')).resolves.toEqual({ clientId: 'cliente-9', domain: 'audience' });
  });

  it('una campaña sin cliente es de la agencia y va al embudo comercial', async () => {
    const { llamar } = resolver({ id: 'c1', clientId: null });
    await expect(llamar('Marca propia')).resolves.toEqual({ domain: 'commercial' });
  });

  it('sin campaña registrada no se guarda nada, en vez de adivinar la empresa', async () => {
    const { llamar } = resolver(null);
    await expect(llamar('Campaña que nadie registró')).resolves.toBeNull();
  });

  it('sin nombre de campaña no se consulta siquiera', async () => {
    const { llamar, campaigns } = resolver({ id: 'c1' });
    await expect(llamar(undefined)).resolves.toBeNull();
    await expect(llamar('   ')).resolves.toBeNull();
    expect(campaigns.findOne).not.toHaveBeenCalled();
  });
});
