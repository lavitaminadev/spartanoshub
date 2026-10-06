import { createResponsablesDouble } from '../../helpers/responsables-del-crm.double';
import { describe, expect, it, vi } from 'vitest';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
import { createAutomatizacionDouble } from '../../helpers/crm-lead-automation.double';
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
      createResponsablesDouble(),
      undefined as never,
      createAutomatizacionDouble() as never,
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

  it('vender la deja en vendido, que es distinto de calificado', async () => {
    // Quien vende necesita distinguir al que compró del que solo prometía: con un solo valor,
    // un tablero con seis calificados no dice cuántos son clientes.
    const { uso } = caso({ ...base });

    const lead = await uso.execute('lead-1', { status: LeadStatus.WON }, 'org-1');

    expect(lead.fitStatus).toBe(LeadFitStatus.SOLD);
    expect(lead.fitStatus).not.toBe(LeadFitStatus.QUALIFIED);
  });

  /*
   * Descartar ya no decide la calificación, y es el cambio que hace medible el CRM.
   *
   * Lo hacía: `lost` ponía «no calificado» sin preguntar. Pero de los nueve motivos de descarte
   * sólo tres significan que la persona no servía —quien compró en otro proyecto era un comprador,
   * y quien nunca respondió no se sabe—, así que el campo afirmaba algo que nadie había dicho.
   *
   * Sin respuesta, la ficha se queda como estaba. No saber es un estado legítimo.
   */
  it('descartar no toca la calificación por su cuenta', async () => {
    const { uso } = caso({ ...base });

    const lead = await uso.execute('lead-1', { status: LeadStatus.LOST, discardReason: 'Precio' }, 'org-1');

    expect(lead.fitStatus).not.toBe(LeadFitStatus.UNQUALIFIED);
  });

  it('la respuesta de quien cierra es la que manda', async () => {
    const { uso } = caso({ ...base });

    const lead = await uso.execute(
      'lead-1',
      { status: LeadStatus.LOST, discardReason: 'Compró en otro proyecto', fitStatus: LeadFitStatus.QUALIFIED },
      'org-1',
    );

    // Se descartó y aun así servía: es el caso que antes era imposible de registrar.
    expect(lead.status).toBe(LeadStatus.LOST);
    expect(lead.fitStatus).toBe(LeadFitStatus.QUALIFIED);
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

  it('vender anuncia la venta; quien reporta arrastra la calificación', async () => {
    /*
     * El caso de uso emite un solo hecho: se vendió. Que Meta necesite además la etapa previa
     * es una regla de esa integración, y quien la conoce es su manejador. Emitir las dos desde
     * acá obligaría a este caso de uso a saber cómo funciona el embudo de un tercero.
     */
    const { uso, emit } = caso({ ...base });

    await uso.execute('lead-1', { status: LeadStatus.WON }, 'org-1');

    expect(nombresEmitidos(emit)).toContain('lead.won');
  });

  /*
   * Cada respuesta manda lo suyo, y «no se supo» no manda nada.
   *
   * Antes todo descarte avisaba a Meta que ese perfil no se busca. Nueve de cada diez cierres son
   * «nunca respondió», donde nadie habló con la persona: afirmarlo era inventar el dato con el que
   * después se decide dónde se gasta la pauta.
   */
  it('afirmar que no servía anuncia el descarte', async () => {
    const { uso, emit } = caso({ ...base });

    await uso.execute(
      'lead-1',
      { status: LeadStatus.LOST, discardReason: 'No es el perfil buscado', fitStatus: LeadFitStatus.UNQUALIFIED },
      'org-1',
    );

    expect(nombresEmitidos(emit)).toContain('lead.discarded');
    expect(nombresEmitidos(emit)).not.toContain('lead.qualified');
  });

  it('afirmar que sí servía anuncia la calificación y no el descarte', async () => {
    const { uso, emit } = caso({ ...base });

    await uso.execute(
      'lead-1',
      { status: LeadStatus.LOST, discardReason: 'Compró en otro proyecto', fitStatus: LeadFitStatus.QUALIFIED },
      'org-1',
    );

    expect(nombresEmitidos(emit)).toContain('lead.qualified');
    expect(nombresEmitidos(emit)).not.toContain('lead.discarded');
  });

  it('no saber si servía no anuncia nada', async () => {
    const { uso, emit } = caso({ ...base });

    await uso.execute(
      'lead-1',
      { status: LeadStatus.LOST, discardReason: 'Nunca respondió', fitStatus: LeadFitStatus.IN_REVIEW },
      'org-1',
    );

    expect(nombresEmitidos(emit)).not.toContain('lead.discarded');
    expect(nombresEmitidos(emit)).not.toContain('lead.qualified');
  });

  it('una reserva que no se concretó no viaja como prospecto descartado', async () => {
    // `lost` lo comparten los dos dominios y no significan lo mismo: un comensal que no fue
    // a comer no es un prospecto que no servía.
    const { uso, emit } = caso({ ...base, domain: 'audience' });

    await uso.execute('lead-1', { status: LeadStatus.LOST, discardReason: 'No llegó' }, 'org-1');

    expect(nombresEmitidos(emit)).not.toContain('lead.discarded');
  });

  it('avanzar de etapa sin calificar no anuncia nada', async () => {
    const { uso, emit } = caso({ ...base });

    await uso.execute('lead-1', { status: LeadStatus.NEGOTIATION }, 'org-1');

    expect(nombresEmitidos(emit)).not.toContain('lead.qualified');
    expect(nombresEmitidos(emit)).not.toContain('lead.won');
    expect(nombresEmitidos(emit)).not.toContain('lead.discarded');
  });
});
