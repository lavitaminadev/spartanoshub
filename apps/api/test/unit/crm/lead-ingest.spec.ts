import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { LeadIngestService } from '../../../src/modules/crm/leads/lead-ingest.service';

/**
 * La entrada por integración tiene dos garantías que no pueden ceder: la llave decide de dónde
 * viene el lead, y recibirlo nunca puede fallar por una cifra de diagnóstico.
 *
 * La primera protege el costo por lead. Si quien llama pudiera declarar su propia fuente, una
 * llave del portal serviría para marcar leads como venidos de una campaña pagada, y el costo por
 * lead —que es lo que decide dónde se invierte— quedaría falseado sin que nada fallara.
 */
const LLAVE = 'esp_in_abc123';
const HUELLA = createHash('sha256').update(LLAVE).digest('hex');

function crear(overrides: Record<string, unknown> = {}) {
  const origen = {
    id: 'src-1', organizationId: 'org-1', clientId: 'cli-1',
    name: 'Portal inmobiliario', source: 'portal', isActive: true,
    ...overrides,
  };
  const sources = {
    findOne: vi.fn(async ({ where }: { where: { tokenHash: string } }) =>
      where.tokenHash === HUELLA ? origen : null),
    update: vi.fn().mockResolvedValue(undefined),
    save: vi.fn(async (v: unknown) => v),
  };
  const intake = { captureLead: vi.fn().mockResolvedValue({ id: 'lead-1' }) };
  return { service: new LeadIngestService(sources as never, intake as never), sources, intake, origen };
}

const LEAD = { nombre: 'Ana Pérez', telefono: '+56912345678' };

describe('entrada de leads por integración', () => {
  beforeEach(() => vi.clearAllMocks());

  it('atribuye el lead a la fuente de la llave', async () => {
    const { service, intake } = crear();
    await service.ingest(LLAVE, LEAD);
    expect(intake.captureLead).toHaveBeenCalledWith(expect.objectContaining({
      source: 'portal', organizationId: 'org-1', clientId: 'cli-1',
    }));
  });

  /** Quien llama no elige su fuente: si pudiera, el costo por lead dejaría de ser confiable. */
  it('ignora una fuente enviada en el cuerpo', async () => {
    const { service, intake } = crear();
    await service.ingest(LLAVE, { ...LEAD, source: 'meta_ads', fuente: 'Meta Ads' } as never);
    expect(intake.captureLead).toHaveBeenCalledWith(expect.objectContaining({ source: 'portal' }));
  });

  it('rechaza una llave desconocida', async () => {
    const { service } = crear();
    await expect(service.ingest('esp_in_falsa', LEAD)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  /**
   * El mensaje no distingue «no existe» de «está apagada»: decirlo confirmaría a un tercero que
   * acertó una llave válida, que es justo lo que se quiere no revelar.
   */
  it('trata igual una llave apagada que una inexistente', async () => {
    const { service, sources } = crear();
    sources.findOne.mockResolvedValue(null);
    await expect(service.ingest(LLAVE, LEAD)).rejects.toThrow('Llave de integración no válida');
  });

  /**
   * Dos portales pueden numerar sus leads igual desde 1. Sin el prefijo del origen, el lead 1 del
   * segundo portal se confundiría con el del primero y uno pisaría al otro.
   */
  it('separa los identificadores externos por origen', async () => {
    const { service, intake } = crear();
    await service.ingest(LLAVE, { ...LEAD, idExterno: '1' });
    expect(intake.captureLead).toHaveBeenCalledWith(expect.objectContaining({
      externalLeadId: 'portal:1',
    }));
  });

  it('deja el identificador vacío cuando el origen no manda uno', async () => {
    const { service, intake } = crear();
    await service.ingest(LLAVE, LEAD);
    expect(intake.captureLead).toHaveBeenCalledWith(expect.objectContaining({
      externalLeadId: undefined,
    }));
  });

  it('cuenta el lead recibido y anota cuándo', async () => {
    const { service, sources } = crear();
    await service.ingest(LLAVE, LEAD);
    expect(sources.update).toHaveBeenCalledWith('src-1', expect.objectContaining({
      lastReceivedAt: expect.any(Date), lastError: null,
    }));
  });

  /**
   * La garantía central con Zapier: reintenta ante cualquier error de servidor. Si perder el
   * contador devolviera un error, Zapier reenviaría el mismo lead y entraría dos veces.
   */
  it('devuelve el lead aunque falle actualizar el contador', async () => {
    const { service, sources } = crear();
    sources.update.mockRejectedValue(new Error('base ocupada'));
    await expect(service.ingest(LLAVE, LEAD)).resolves.toMatchObject({ leadId: 'lead-1' });
  });

  it('anota el motivo cuando el lead no se pudo guardar', async () => {
    const { service, sources, intake } = crear();
    intake.captureLead.mockRejectedValue(new Error('cliente inexistente'));

    await expect(service.ingest(LLAVE, LEAD)).rejects.toThrow('cliente inexistente');
    expect(sources.update).toHaveBeenCalledWith('src-1', expect.objectContaining({
      lastError: 'cliente inexistente',
    }));
  });

  /** La llave se muestra una vez; después solo se rota. Guardarla en claro la haría recuperable. */
  it('guarda la huella de la llave y nunca la llave', async () => {
    const { service, origen } = crear();
    const { token } = await service.issueToken(origen as never);

    expect(token).toMatch(/^esp_in_[a-f0-9]{48}$/);
    expect((origen as { tokenHash: string }).tokenHash)
      .toBe(createHash('sha256').update(token).digest('hex'));
    expect((origen as { tokenHash: string }).tokenHash).not.toContain(token);
  });
});
