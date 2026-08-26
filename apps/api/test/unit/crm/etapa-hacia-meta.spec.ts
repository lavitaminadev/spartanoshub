import { describe, expect, it, vi } from 'vitest';
import { LeadStageChangedHandler } from '../../../src/modules/integrations/meta/handlers/lead-stage-changed.handler';

/**
 * Qué se le reporta a Meta cuando un lead cambia de etapa.
 *
 * Las comprobaciones que importan no son que el evento salga, sino **cuándo no sale**: cada una
 * de estas puertas evita mandar datos personales a un tercero por un lead que no le corresponde,
 * o un identificador que Meta no puede emparejar y que le haría rechazar el envío entero.
 */
function montar(overrides: {
  lead?: Record<string, unknown> | null;
  tieneCapacidad?: boolean;
  pixelId?: string;
} = {}) {
  const outbox = { enqueue: vi.fn() };
  const clientPixels = {
    resolveForScope: vi.fn().mockResolvedValue({
      pixelId: overrides.pixelId ?? 'pixel-1',
      pixelName: null,
      accessToken: 'token-1',
      pixelSource: 'client',
      tokenSource: 'client',
    }),
  };
  const capacidades = { tiene: vi.fn().mockResolvedValue(overrides.tieneCapacidad ?? true) };
  const lead = overrides.lead === undefined
    ? {
      id: 'lead-1',
      source: 'meta_lead_ads',
      externalLeadId: '1234567890123456',
      campaignName: null,
      estimatedAmount: null,
    }
    : overrides.lead;
  const leads = { findOne: vi.fn().mockResolvedValue(lead) };
  const campaigns = { findOne: vi.fn().mockResolvedValue(null) };

  const handler = new LeadStageChangedHandler(
    outbox as never, clientPixels as never, capacidades as never,
    leads as never, campaigns as never,
  );
  return { handler, outbox, capacidades, clientPixels };
}

const evento = (toStage = 'won') => ({
  organizationId: 'org-1',
  leadId: 'lead-1',
  clientId: 'client-1',
  fromStage: 'contacted',
  toStage,
});

describe('etapa del CRM hacia Meta', () => {
  it('reporta la etapa con el identificador de Meta sin hashear', async () => {
    const { handler, outbox } = montar();

    await handler.handle(evento('contacted'));

    expect(outbox.enqueue).toHaveBeenCalledWith('org-1', 'pixel-1', expect.objectContaining({
      eventName: 'Contactado',
      actionSource: 'system_generated',
      // `lead_id` viaja en claro a propósito: es un número de Meta, no un dato personal, y
      // hasheado deja de emparejarse con su lead.
      userData: { lead_id: '1234567890123456' },
      customData: expect.objectContaining({ eventSource: 'crm', leadEventSource: 'Espartanos' }),
      eventId: 'lead-stage:lead-1:contacted',
    }));
  });

  it('el identificador es estable por etapa, así que ir y volver no duplica', async () => {
    const { handler, outbox } = montar();

    await handler.handle(evento('negotiation'));
    await handler.handle(evento('negotiation'));

    const [primera, segunda] = outbox.enqueue.mock.calls;
    expect(primera[2].eventId).toBe(segunda[2].eventId);
  });

  it('el monto solo viaja en la venta, no en las etapas intermedias', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'meta_lead_ads', externalLeadId: '1234567890123456',
        campaignName: null, estimatedAmount: 2_500_000,
      },
    });

    await handler.handle(evento('negotiation'));
    expect(outbox.enqueue.mock.calls[0][2].customData.value).toBeUndefined();

    await handler.handle(evento('won'));
    expect(outbox.enqueue.mock.calls[1][2].customData).toMatchObject({ value: 2_500_000, currency: 'CLP' });
  });

  it('no reporta un lead que no vino de un formulario instantáneo', async () => {
    const { handler, outbox } = montar({
      lead: { id: 'lead-1', source: 'importacion', externalLeadId: null, campaignName: null },
    });

    await handler.handle(evento());

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('no reporta un identificador que no tiene forma de leadgen_id', async () => {
    // Comprobado contra datos reales: de cinco leads de Meta en producción, tres llevaban un
    // identificador escrito a mano. Sin esta puerta se enviaban, Meta los rechazaba, y quedaban
    // en la cola de fallidos mezclados con los problemas de verdad.
    const { handler, outbox } = montar({
      lead: { id: 'lead-1', source: 'meta_lead_ads', externalLeadId: 'TEST-POWERSHELL-20260825', campaignName: null },
    });

    await handler.handle(evento());

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('no reporta cuando el identificador lleva prefijo: no es un lead de Meta', async () => {
    // `identificadorExterno` antepone el origen salvo para `meta_lead_ads`. Mandar «zapier:99»
    // como `lead_id` hace que Meta rechace el envío entero.
    const { handler, outbox } = montar({
      lead: { id: 'lead-1', source: 'meta_lead_ads', externalLeadId: 'zapier:99', campaignName: null },
    });

    await handler.handle(evento());

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('no reporta si la empresa no tiene la capacidad contratada', async () => {
    const { handler, outbox } = montar({ tieneCapacidad: false });

    await handler.handle(evento());

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('no reporta un prospecto de la agencia, que no pertenece a ninguna cuenta publicitaria', async () => {
    const { handler, outbox, capacidades } = montar();

    await handler.handle({ ...evento(), clientId: null });

    expect(capacidades.tiene).not.toHaveBeenCalled();
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('no reporta si la empresa no tiene Pixel configurado', async () => {
    const { handler, outbox } = montar({ pixelId: '' });

    await handler.handle(evento());

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('un fallo al reportar nunca se propaga: guardar el lead no puede depender de Meta', async () => {
    const { handler, outbox } = montar();
    outbox.enqueue.mockRejectedValue(new Error('Meta caído'));

    await expect(handler.handle(evento())).resolves.toBeUndefined();
  });
});
