import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { LeadIngestService } from '../../../src/modules/crm/leads/lead-ingest.service';

/**
 * Qué pasa con la llave anterior cuando se rota.
 *
 * Rotar mataba la llave en el acto, y entre el clic y el momento en que alguien pegaba la nueva
 * en Make todo lead que llegara se perdía sin dejar rastro: la integración recibía 401 y el lead
 * no quedaba ni como error. El hueco importaba justo cuando más urge rotar —una llave filtrada—,
 * porque entonces se rota rápido y se actualiza después.
 *
 * Estas pruebas fijan las dos mitades del trato: la anterior sirve durante la ventana, y deja de
 * servir en cuanto la ventana pasa o alguien la corta.
 */
function montar(fila: Record<string, unknown> | null = null) {
  const guardadas: Record<string, unknown>[] = [];
  const sources = {
    findOne: vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
      if (!fila) return null;
      if (where.tokenHash && fila.tokenHash === where.tokenHash) return fila;
      if (where.previousTokenHash && fila.previousTokenHash === where.previousTokenHash) return fila;
      return null;
    }),
    save: vi.fn().mockImplementation((entidad: Record<string, unknown>) => {
      guardadas.push({ ...entidad });
      return entidad;
    }),
    update: vi.fn().mockResolvedValue(undefined),
  };
  const intake = { captureLead: vi.fn().mockResolvedValue({ id: 'lead-1' }) };
  const campaigns = { findOne: vi.fn().mockResolvedValue(null) };

  const service = new LeadIngestService(sources as never, campaigns as never, intake as never);
  return { service, sources, intake, guardadas };
}

const cuerpo = { nombre: 'Ana', telefono: '+56911112222' } as never;

describe('gracia de la llave anterior', () => {
  it('al rotar, la anterior queda guardada con fecha de caducidad', async () => {
    const fila: Record<string, unknown> = { id: 'src-1', tokenHash: 'huella-vieja', tokenHint: 'aaaaaa' };
    const { service } = montar(fila);

    const antes = Date.now();
    const { source } = await service.issueToken(fila as never);

    expect(source.previousTokenHash).toBe('huella-vieja');
    expect(source.tokenHash).not.toBe('huella-vieja');
    // 48 horas, con margen para el tiempo que tarda la propia prueba.
    const ventana = source.previousTokenExpiresAt!.getTime() - antes;
    expect(ventana).toBeGreaterThan(47 * 3600_000);
    expect(ventana).toBeLessThanOrEqual(48 * 3600_000 + 5_000);
  });

  it('en el alta no hay anterior que conservar', async () => {
    const fila: Record<string, unknown> = { id: 'src-1' };
    const { service } = montar(fila);

    const { source } = await service.issueToken(fila as never);

    expect(source.previousTokenHash).toBeUndefined();
    expect(source.previousTokenExpiresAt).toBeUndefined();
  });

  it('la llave nueva entra por el camino normal', async () => {
    const fila: Record<string, unknown> = { id: 'src-1', tokenHint: 'aaaaaa' };
    const { service, intake } = montar(fila);
    const { source, token } = await service.issueToken(fila as never);
    Object.assign(fila, source, { isActive: true, organizationId: 'org-1', source: 'meta_lead_ads' });

    await service.ingest(token, cuerpo);

    expect(intake.captureLead).toHaveBeenCalled();
  });

  it('la anterior sigue aceptando mientras dura la ventana', async () => {
    // Ésta es la prueba que justifica todo el cambio: el lead que llega con la llave vieja,
    // antes de que nadie haya actualizado Make, entra igual en vez de perderse.
    const fila: Record<string, unknown> = { id: 'src-1', tokenHint: 'aaaaaa' };
    const { service, intake } = montar(fila);

    const { token: viejo } = await service.issueToken(fila as never);
    const { source } = await service.issueToken(fila as never);
    Object.assign(fila, source, { isActive: true, organizationId: 'org-1', source: 'meta_lead_ads' });

    await service.ingest(viejo, cuerpo);

    expect(intake.captureLead).toHaveBeenCalled();
  });

  it('la anterior deja de servir cuando la ventana pasó', async () => {
    const fila: Record<string, unknown> = { id: 'src-1', tokenHint: 'aaaaaa' };
    const { service, intake } = montar(fila);
    const { token: viejo } = await service.issueToken(fila as never);
    const { source } = await service.issueToken(fila as never);

    Object.assign(fila, source, {
      isActive: true, organizationId: 'org-1', source: 'meta_lead_ads',
      // Caducada hace un minuto: la huella sigue guardada y aun así no vale.
      previousTokenExpiresAt: new Date(Date.now() - 60_000),
    });

    await expect(service.ingest(viejo, cuerpo)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(intake.captureLead).not.toHaveBeenCalled();
  });

  it('cortarla la invalida antes de que caduque sola', async () => {
    const fila: Record<string, unknown> = { id: 'src-1', tokenHint: 'aaaaaa' };
    const { service, intake } = montar(fila);
    const { token: viejo } = await service.issueToken(fila as never);
    const { source } = await service.issueToken(fila as never);
    Object.assign(fila, source, { isActive: true, organizationId: 'org-1', source: 'meta_lead_ads' });

    await service.revokePreviousToken(fila as never);

    await expect(service.ingest(viejo, cuerpo)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(intake.captureLead).not.toHaveBeenCalled();
  });

  it('un origen apagado no acepta ni la vigente ni la anterior', async () => {
    const fila: Record<string, unknown> = { id: 'src-1', tokenHint: 'aaaaaa' };
    const { service } = montar(fila);
    const { token: viejo } = await service.issueToken(fila as never);
    const { source, token: nuevo } = await service.issueToken(fila as never);
    // `isActive: false` hace que la búsqueda no devuelva la fila por ninguna de las dos columnas.
    Object.assign(fila, source, { isActive: false });

    const apagado = montar(null);
    await expect(apagado.service.ingest(viejo, cuerpo)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(apagado.service.ingest(nuevo, cuerpo)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
