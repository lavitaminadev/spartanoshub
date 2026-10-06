import { createResponsablesDouble } from '../../helpers/responsables-del-crm.double';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
import { createAutomatizacionDouble } from '../../helpers/crm-lead-automation.double';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';

/**
 * Descartar sin decir por qué deja el informe a medias.
 *
 * La ficha ya lo pedía, pero arrastrar la tarjeta y mover en lote mandaban solo el estado: la
 * mitad de los descartes se guardaban sin causa. La comprobación va en el caso de uso porque es
 * el único sitio por el que pasan todos los caminos.
 */
function caso(lead: Record<string, unknown>) {
  const repo = {
    findOne: vi.fn().mockResolvedValue(lead),
    save: vi.fn(async (valor) => valor),
  };
  const history = { recordStageChange: vi.fn() };
  const cierre = { avisar: vi.fn() };
  const events = { emit: vi.fn() };
  const automatizacion = createAutomatizacionDouble();
  return {
    uso: new UpdateLeadUseCase(repo as never, history as never, cierre as never, events as never, createResponsablesDouble(), undefined as never, automatizacion as never),
    repo,
    events,
    automatizacion,
  };
}

const base = {
  id: 'lead-1', organizationId: 'org-1', domain: 'commercial',
  status: LeadStatus.CONTACTED, discardReason: null,
};

describe('descartar exige motivo', () => {
  it('rechaza el descarte sin motivo', async () => {
    const { uso, repo } = caso({ ...base });

    await expect(uso.execute('lead-1', { status: LeadStatus.LOST }, 'org-1', 'user-1'))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('acepta el descarte con motivo', async () => {
    const { uso, repo } = caso({ ...base });

    await uso.execute('lead-1', { status: LeadStatus.LOST, discardReason: 'Nunca respondió' }, 'org-1', 'user-1');

    expect(repo.save).toHaveBeenCalled();
  });

  it('un lead ya descartado no vuelve a pedir el motivo', async () => {
    // Corregir el teléfono de un descarte antiguo no es descartarlo otra vez.
    const { uso, repo } = caso({ ...base, status: LeadStatus.LOST, discardReason: 'Precio' });

    await uso.execute('lead-1', { phone: '+56911111111' }, 'org-1', 'user-1');

    expect(repo.save).toHaveBeenCalled();
  });

  it('no estorba a las demás etapas', async () => {
    const { uso, repo } = caso({ ...base });

    await uso.execute('lead-1', { status: LeadStatus.QUOTE_SENT }, 'org-1', 'user-1');

    expect(repo.save).toHaveBeenCalled();
  });
});

/*
 * El cierre tiene que quedar en el historial de la ficha.
 *
 * No quedaba: la automatización que escribe esa constancia sólo corre al crear el lead, así que un
 * descarte hecho por una persona —que son casi todos— no dejaba ninguna línea. En la base había 65
 * descartes y cero constancias. El motivo vivía en una columna del lead que la línea de tiempo no
 * muestra, así que al abrir una ficha cerrada no se veía ni quién la cerró ni cuándo.
 */
describe('descartar deja constancia en el historial', () => {
  it('anota el cierre con quien lo hizo', async () => {
    const { uso, automatizacion } = caso({ ...base });

    await uso.execute('lead-1', { status: LeadStatus.LOST, discardReason: 'Nunca respondió' }, 'org-1', 'user-1');

    expect(automatizacion.ensureDiscardInteraction).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'lead-1' }),
      undefined,
      'user-1',
    );
  });

  it('no anota nada cuando no se está descartando', async () => {
    const { uso, automatizacion } = caso({ ...base });

    await uso.execute('lead-1', { status: LeadStatus.NEGOTIATION }, 'org-1', 'user-1');

    expect(automatizacion.ensureDiscardInteraction).not.toHaveBeenCalled();
  });

  /*
   * El ciclo de reserva comparte el estado «perdido» y no es lo mismo: un comensal que no fue a
   * comer no es un prospecto que se descartó.
   */
  it('no anota el cierre de una reserva que no se concretó', async () => {
    const { uso, automatizacion } = caso({ ...base, domain: 'audience' });

    await uso.execute('lead-1', { status: LeadStatus.LOST, discardReason: 'No llegó' }, 'org-1', 'user-1');

    expect(automatizacion.ensureDiscardInteraction).not.toHaveBeenCalled();
  });

  /*
   * Si la constancia falla, el descarte igual queda guardado.
   *
   * Deshacer un cierre que la persona confirmó, por un fallo al anotar la línea del historial,
   * sería peor que perder la línea.
   */
  it('un fallo al anotar no deshace el descarte', async () => {
    const { uso, repo, automatizacion } = caso({ ...base });
    automatizacion.ensureDiscardInteraction.mockRejectedValue(new Error('base caída'));

    await expect(
      uso.execute('lead-1', { status: LeadStatus.LOST, discardReason: 'Precio' }, 'org-1', 'user-1'),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });
});
