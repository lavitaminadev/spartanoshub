import { createResponsablesDouble } from '../../helpers/responsables-del-crm.double';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
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
  return {
    uso: new UpdateLeadUseCase(repo as never, history as never, cierre as never, events as never, createResponsablesDouble()),
    repo,
    events,
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
