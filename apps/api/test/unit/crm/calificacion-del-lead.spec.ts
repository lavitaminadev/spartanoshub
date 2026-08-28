import { describe, expect, it, vi } from 'vitest';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';
import { LeadFitStatus } from '../../../src/modules/crm/leads/lead-fit-status.enum';

/**
 * La calificación es un eje aparte de la etapa.
 *
 * Dice cuánto vale el lead, no dónde va, y la decide la persona que habló con él. Solo el
 * desenlace la fija por su cuenta: una venta es la afirmación más fuerte de que encajaba y un
 * descarte la contraria. Que una etapa intermedia la moviera convertía el campo en una copia de
 * la etapa y le quitaba a quien vende la única forma de decir «este me interesa» antes de tiempo.
 */
function caso(lead: Record<string, unknown>) {
  const repo = { findOne: vi.fn().mockResolvedValue(lead), save: vi.fn(async (v) => v) };
  const emit = vi.fn();
  return {
    emit,
    uso: new UpdateLeadUseCase(
      repo as never,
      { recordStageChange: vi.fn() } as never,
      { avisar: vi.fn() } as never,
      { emit } as never,
    ),
  };
}

const base = {
  id: 'lead-1', organizationId: 'org-1', domain: 'commercial', clientId: 'client-1',
  status: LeadStatus.CONTACTED, fitStatus: LeadFitStatus.REVIEW, discardReason: null,
};

const nombresEmitidos = (emit: ReturnType<typeof vi.fn>) => emit.mock.calls.map((c) => c[0]);

describe('la calificación del lead', () => {
  it.each([
    ['Calificado', LeadStatus.QUOTE_SENT],
    ['Visita agendada', LeadStatus.MEETING_SCHEDULED],
    ['Negociación', LeadStatus.NEGOTIATION],
  ])('avanzar a «%s» no la toca: sigue siendo decisión de quien vende', async (_rotulo, status) => {
    const { uso } = caso({ ...base });

    const lead = await uso.execute('lead-1', { status }, 'org-1');

    expect(lead.fitStatus).toBe(LeadFitStatus.REVIEW);
  });

  it('vender la pone en calificado', async () => {
    const { uso } = caso({ ...base });

    const lead = await uso.execute('lead-1', { status: LeadStatus.WON }, 'org-1');

    expect(lead.fitStatus).toBe(LeadFitStatus.QUALIFIED);
  });

  it('descartar la pone en no calificado', async () => {
    const { uso } = caso({ ...base });

    const lead = await uso.execute('lead-1', { status: LeadStatus.LOST, discardReason: 'Precio' }, 'org-1');

    expect(lead.fitStatus).toBe(LeadFitStatus.UNQUALIFIED);
  });

  it('una corrección a mano gana sobre el desenlace', async () => {
    const { uso } = caso({ ...base });

    const lead = await uso.execute(
      'lead-1',
      { status: LeadStatus.WON, fitStatus: LeadFitStatus.REVIEW },
      'org-1',
    );

    expect(lead.fitStatus).toBe(LeadFitStatus.REVIEW);
  });

  it('el ciclo de reserva no califica a nadie', async () => {
    // Quien reservó una mesa no es un prospecto que encaje o no.
    const { uso } = caso({ ...base, domain: 'audience', status: LeadStatus.NEW });

    const lead = await uso.execute('lead-1', { status: LeadStatus.RESERVED }, 'org-1');

    expect(lead.fitStatus).toBe(LeadFitStatus.REVIEW);
  });
});

describe('qué se le anuncia a Meta', () => {
  it('calificar a mano anuncia la señal, sin necesidad de cambiar de etapa', async () => {
    const { uso, emit } = caso({ ...base });

    await uso.execute('lead-1', { fitStatus: LeadFitStatus.QUALIFIED }, 'org-1');

    expect(nombresEmitidos(emit)).toContain('lead.qualified');
  });

  /*
   * Sin esto, cada guardado posterior de la ficha volvería a anunciar la misma calificación. La
   * cola deduplica por `event_id`, pero encolar de más deja ruido en la bandeja y trabajo que
   * nadie necesita.
   */
  it('guardar otra cosa en un lead ya calificado no la vuelve a anunciar', async () => {
    const { uso, emit } = caso({ ...base, fitStatus: LeadFitStatus.QUALIFIED });

    await uso.execute('lead-1', { notes: 'llamé de nuevo' }, 'org-1');

    expect(nombresEmitidos(emit)).not.toContain('lead.qualified');
  });

  it('vender anuncia las dos señales: califica y compra', async () => {
    const { uso, emit } = caso({ ...base });

    await uso.execute('lead-1', { status: LeadStatus.WON }, 'org-1');

    expect(nombresEmitidos(emit)).toContain('lead.qualified');
    expect(nombresEmitidos(emit)).toContain('lead.won');
  });

  it('descartar no anuncia nada a Meta', async () => {
    const { uso, emit } = caso({ ...base });

    await uso.execute('lead-1', { status: LeadStatus.LOST, discardReason: 'Precio' }, 'org-1');

    expect(nombresEmitidos(emit)).not.toContain('lead.qualified');
    expect(nombresEmitidos(emit)).not.toContain('lead.won');
  });

  it('avanzar de etapa sin calificar no anuncia nada', async () => {
    const { uso, emit } = caso({ ...base });

    await uso.execute('lead-1', { status: LeadStatus.NEGOTIATION }, 'org-1');

    expect(nombresEmitidos(emit)).not.toContain('lead.qualified');
    expect(nombresEmitidos(emit)).not.toContain('lead.won');
  });
});
