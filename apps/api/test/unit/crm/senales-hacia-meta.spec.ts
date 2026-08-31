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
  it('la calificación viaja con el nombre de la etapa, sin monto', async () => {
    const { handler, outbox } = montar();

    await handler.calificado(evento);

    expect(outbox.enqueue).toHaveBeenCalledWith('org-1', 'pixel-1', expect.objectContaining({
      eventName: 'Calificado',
      eventId: 'lead-calificacion:lead-1',
      userData: expect.objectContaining({ lead_id: '1234567890123456' }),
      customData: expect.objectContaining({ value: undefined, currency: undefined, eventSource: 'crm' }),
    }));
  });

  it('el lead recibido es la primera etapa, la que da el denominador', async () => {
    const { handler, outbox } = montar();

    await handler.recibido(evento);

    expect(outbox.enqueue).toHaveBeenCalledWith('org-1', 'pixel-1', expect.objectContaining({
      eventName: 'Lead recibido',
      eventId: 'lead-recibido:lead-1',
    }));
  });

  it('el descarte viaja como su propia etapa', async () => {
    const { handler, outbox } = montar();

    await handler.descartado(evento);

    expect(outbox.enqueue).toHaveBeenCalledWith('org-1', 'pixel-1', expect.objectContaining({
      eventName: 'Descartado',
      eventId: 'lead-descarte:lead-1',
    }));
  });

  /*
   * La especificación exige que las etapas previas ya se hayan enviado cuando un lead llega a
   * la última. El identificador estable evita duplicarla si ya salió.
   */
  it('la venta arrastra la calificación, en ese orden', async () => {
    const { handler, outbox } = montar();

    await handler.vendido(evento);

    const nombres = outbox.enqueue.mock.calls.map((llamada: unknown[]) => (llamada[2] as { eventName: string }).eventName);
    expect(nombres).toEqual(['Calificado', 'Vendido']);
  });

  it('manda nombre, apellido y país para emparejar mejor', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: null, email: 'p@e.cl', phone: null, metadata: null,
        name: 'Ana María Pérez Soto',
      },
    });

    await handler.calificado(evento);

    expect(outbox.enqueue.mock.calls[0][2].userData).toMatchObject({
      fn: ['Ana'], ln: ['María Pérez Soto'], country: ['cl'],
    });
  });

  it('un nombre de una sola palabra no inventa apellido', async () => {
    // Una cadena vacía produce un hash que no empareja con nadie y ensucia el evento.
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: null, email: 'p@e.cl', phone: null, metadata: null, name: 'Martín',
      },
    });

    await handler.calificado(evento);

    expect(outbox.enqueue.mock.calls[0][2].userData.fn).toEqual(['Martín']);
    expect(outbox.enqueue.mock.calls[0][2].userData.ln).toBeUndefined();
  });

  it('la venta lleva el monto y su moneda cuando se anotaron', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: '250000', email: 'p@e.cl', phone: null, metadata: null,
      },
    });

    await handler.vendido(evento);

    expect(outbox.enqueue).toHaveBeenLastCalledWith('org-1', 'pixel-1', expect.objectContaining({
      eventName: 'Vendido',
      eventId: 'lead-venta:lead-1',
      customData: expect.objectContaining({ value: 250000, currency: 'CLP' }),
    }));
  });

  /*
   * Con el nombre de etapa libre no hay validación de evento estándar. Usar `Purchase` la
   * activaba y Meta rechazaba las ventas sin importe con «code=100 subcode=2804010»: la
   * conversión se perdía y solo aparecía días después en la cola de fallidos.
   */
  it('una venta sin monto se reporta igual, con su mismo nombre', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: null, email: 'p@e.cl', phone: null, metadata: null,
      },
    });

    await handler.vendido(evento);

    const enviado = outbox.enqueue.mock.calls[1][2];
    expect(enviado.eventName).toBe('Vendido');
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

    expect(outbox.enqueue.mock.calls[1][2].eventName).toBe('Vendido');
    expect(outbox.enqueue.mock.calls[1][2].customData.value).toBeUndefined();
  });

  it('el identificador del evento es estable por etapa', async () => {
    const { handler, outbox } = montar({
      lead: {
        id: 'lead-1', source: 'web', externalLeadId: null, campaignName: null,
        estimatedAmount: null, email: 'p@e.cl', phone: null, metadata: null,
      },
    });

    await handler.vendido(evento);

    expect(outbox.enqueue.mock.calls[1][2].eventId).toBe('lead-venta:lead-1');
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

describe('leads excluidos del reporte', () => {
  const excluido = {
    id: 'lead-1', source: 'meta_lead_ads', externalLeadId: '1234567890123456',
    campaignName: null, estimatedAmount: '250000', email: 'p@e.cl', phone: null,
    metadata: null, excludedFromMeta: true,
  };

  it('no reporta la calificación de un lead marcado como excluido', async () => {
    const { handler, outbox } = montar({ lead: excluido });

    await handler.calificado(evento);

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('tampoco reporta su venta, aunque tenga monto', async () => {
    const { handler, outbox } = montar({ lead: excluido });

    await handler.vendido(evento);

    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('no consulta el Pixel de un lead excluido', async () => {
    // Se corta antes de resolver credenciales: lo que no va a salir no toca la configuración
    // de la empresa ni deja rastro de haberlo intentado.
    const { handler, clientPixels } = montar({ lead: excluido });

    await handler.vendido(evento);

    expect(clientPixels.resolveForScope).not.toHaveBeenCalled();
  });

  it('un lead sin la marca se reporta con normalidad', async () => {
    const { handler, outbox } = montar({ lead: { ...excluido, excludedFromMeta: false } });

    await handler.vendido(evento);

    // Dos: la venta arrastra la calificación, porque la etapa previa tiene que haber salido.
    expect(outbox.enqueue).toHaveBeenCalledTimes(2);
  });
});
