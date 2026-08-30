import { describe, expect, it, vi } from 'vitest';
import { LeadStageChangedHandler } from '../../../src/modules/integrations/meta/handlers/lead-stage-changed.handler';

/**
 * Qué se le reporta a Meta sobre un lead, y sobre todo qué no.
 *
 * Son dos señales: que alguien afirmó que el lead vale la pena, y que compró. Cada puerta que se
 * comprueba acá evita mandar datos personales a un tercero por un lead que no le corresponde, o
 * un identificador que Meta no puede emparejar y que le haría rechazar el envío entero.
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
      email: 'persona@ejemplo.cl',
      phone: '912345678',
      metadata: null,
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

const evento = { organizationId: 'org-1', leadId: 'lead-1', clientId: 'client-1' };

describe('señales del CRM hacia Meta', () => {
  it('la calificación viaja como QualifiedLead, sin monto', async () => {
    const { handler, outbox } = montar();

    await handler.calificado(evento);

    expect(outbox.enqueue).toHaveBeenCalledWith('org-1', 'pixel-1', expect.objectContaining({
      eventName: 'QualifiedLead',
      eventId: 'lead-calificacion:lead-1',
      userData: expect.objectContaining({ lead_id: '1234567890123456' }),
      customData: expect.objectContaining({ value: undefined, currency: undefined, eventSource: 'crm' }),
    }));
  });

  it('la venta viaja como Purchase, con el monto y su moneda', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: '250000', email: 'p@e.cl', phone: null, metadata: null,
      },
    });

    await handler.vendido(evento);

    expect(outbox.enqueue).toHaveBeenCalledWith('org-1', 'pixel-1', expect.objectContaining({
      eventName: 'Purchase',
      eventId: 'lead-venta:lead-1',
      customData: expect.objectContaining({ value: 250000, currency: 'CLP' }),
    }));
  });

  /*
   * `Purchase` es un evento estandar y su definicion exige `value` y `currency`. Se enviaba igual
   * sin monto, y Meta lo devolvia con «Invalid parameter»: la venta se perdia y solo aparecia dias
   * despues en la cola de fallidos.
   */
  it('una venta sin monto no viaja como Purchase, que lo exige', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: null, email: 'p@e.cl', phone: null, metadata: null,
      },
    });

    await handler.vendido(evento);

    const enviado = outbox.enqueue.mock.calls[0][2];
    expect(enviado.eventName).toBe('Venta');
    expect(enviado.customData.value).toBeUndefined();
    expect(enviado.customData.currency).toBeUndefined();
  });

  it('un monto cero tampoco cuenta como importe', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: '0', email: 'p@e.cl', phone: null, metadata: null,
      },
    });

    await handler.vendido(evento);

    expect(outbox.enqueue.mock.calls[0][2].eventName).toBe('Venta');
  });

  it('el identificador del evento no cambia con el nombre: sigue siendo la misma venta', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: null, email: 'p@e.cl', phone: null, metadata: null,
      },
    });

    await handler.vendido(evento);

    expect(outbox.enqueue.mock.calls[0][2].eventId).toBe('lead-venta:lead-1');
  });

  /*
   * El descarte no tiene manejador, y esta prueba lo deja escrito. La documentacion de Meta pide
   * enviar todas las etapas y clasificarlas en Events Manager, asi que esto esta pendiente de
   * revisar; mientras tanto, que nadie lo agregue sin decidirlo.
   */
  it('no existe forma de reportar un descarte', () => {
    const { handler } = montar();
    expect((handler as unknown as Record<string, unknown>).descartado).toBeUndefined();
  });

  /*
   * Antes solo se reportaban los leads de formularios instantáneos. El correo y el teléfono
   * emparejan igual, así que excluir a los demás era tirar la mitad de la señal.
   */
  it('reporta un lead que no vino de un formulario instantáneo, sin lead_id', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: null, email: 'persona@ejemplo.cl', phone: '912345678', metadata: null,
      },
    });

    await handler.calificado(evento);

    const enviado = outbox.enqueue.mock.calls[0][2];
    expect(enviado.userData.lead_id).toBeUndefined();
    expect(enviado.userData.em).toEqual(['persona@ejemplo.cl']);
    expect(enviado.userData.externalId).toEqual(['lead-1']);
  });

  it('no manda como lead_id un identificador que no tiene forma de leadgen_id', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'meta_lead_ads', externalLeadId: 'prueba:123', campaignName: null,
        estimatedAmount: null, email: 'p@e.cl', phone: null, metadata: null,
      },
    });

    await handler.calificado(evento);

    expect(outbox.enqueue.mock.calls[0][2].userData.lead_id).toBeUndefined();
  });

  it('reconstruye el fbc desde el fbclid guardado cuando no hay cookie', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: null, email: 'p@e.cl', phone: null,
        metadata: { attribution: { fbclid: 'AbC_123', capturedAt: '2026-01-01T00:00:00.000Z' } },
      },
    });

    await handler.calificado(evento);

    expect(outbox.enqueue.mock.calls[0][2].userData.fbc).toBe('fb.1.1767225600000.AbC_123');
  });

  it('no reporta si la empresa no tiene la capacidad contratada', async () => {
    const { handler, outbox } = montar({ tieneCapacidad: false });
    await handler.calificado(evento);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('no reporta un prospecto de la agencia, que no pertenece a ninguna cuenta publicitaria', async () => {
    const { handler, outbox } = montar();
    await handler.calificado({ ...evento, clientId: null });
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('no reporta si la empresa no tiene Pixel configurado', async () => {
    const { handler, outbox } = montar({ pixelId: '' });
    await handler.calificado(evento);
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('un fallo al reportar nunca se propaga: guardar el lead no puede depender de Meta', async () => {
    const { handler, outbox } = montar();
    outbox.enqueue.mockRejectedValue(new Error('Meta caído'));
    await expect(handler.calificado(evento)).resolves.toBeUndefined();
  });
});
