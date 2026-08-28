import { describe, expect, it, vi } from 'vitest';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';
import { LeadFitStatus } from '../../../src/modules/crm/leads/lead-fit-status.enum';

/**
 * La calidad la fija la etapa, no un puntaje que nadie recalcula.
 *
 * El puntaje se calculaba al entrar y no se volvía a mirar: un lead en Negociación seguía
 * diciendo «En revisión», y el campo dejaba de significar nada. Llegar a una etapa avanzada ya es
 * alguien afirmando que encaja.
 */
function caso(lead: Record<string, unknown>) {
  const repo = { findOne: vi.fn().mockResolvedValue(lead), save: vi.fn(async (v) => v) };
  return {
    uso: new UpdateLeadUseCase(
      repo as never,
      { recordStageChange: vi.fn() } as never,
      { avisar: vi.fn() } as never,
      { emit: vi.fn() } as never,
    ),
  };
}

const base = {
  id: 'lead-1', organizationId: 'org-1', domain: 'commercial',
  status: LeadStatus.CONTACTED, fitStatus: LeadFitStatus.REVIEW, discardReason: null,
};

describe('la calidad sigue a la etapa', () => {
  it('avanzar a Calificado la pone en calificado', async () => {
    const { uso } = caso({ ...base });

    const lead = await uso.execute('lead-1', { status: LeadStatus.QUOTE_SENT }, 'org-1');

    expect(lead.fitStatus).toBe(LeadFitStatus.QUALIFIED);
  });

  it('llegar a Negociación también, aunque se salte etapas', async () => {
    const { uso } = caso({ ...base });

    const lead = await uso.execute('lead-1', { status: LeadStatus.NEGOTIATION }, 'org-1');

    expect(lead.fitStatus).toBe(LeadFitStatus.QUALIFIED);
  });

  it('descartar la pone en no calificado', async () => {
    const { uso } = caso({ ...base });

    const lead = await uso.execute('lead-1', { status: LeadStatus.LOST, discardReason: 'Precio' }, 'org-1');

    expect(lead.fitStatus).toBe(LeadFitStatus.UNQUALIFIED);
  });

  it('«Contactado» no la toca: sigue siendo triaje', async () => {
    // Contactar no dice nada sobre si encaja; ahí el puntaje de entrada es lo único que hay.
    const { uso } = caso({ ...base, status: LeadStatus.NEW });

    const lead = await uso.execute('lead-1', { status: LeadStatus.CONTACTED }, 'org-1');

    expect(lead.fitStatus).toBe(LeadFitStatus.REVIEW);
  });

  it('una corrección a mano gana sobre la etapa', async () => {
    // Quien corrige la calificación está diciendo algo que la etapa no sabe.
    const { uso } = caso({ ...base });

    const lead = await uso.execute(
      'lead-1',
      { status: LeadStatus.QUOTE_SENT, fitStatus: LeadFitStatus.REVIEW },
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
