/**
 * Qué se garantiza al editar un lead: sin campos propios en la petición no se validan ni se tocan,
 * y con ellos se fusionan con lo que ya había en vez de reemplazarlo.
 *
 * Es lo que permite mover tarjetas y cambiar etapas en lote aunque existan campos obligatorios, y
 * lo que evita que guardar un campo desde la ficha borre los demás.
 */

import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';
import { createProcessHistoryDouble } from '../../helpers/process-history.double';
import { createLeadCierreDouble } from '../../helpers/lead-cierre.double';
import { createResponsablesDouble } from '../../helpers/responsables-del-crm.double';

function armar(guardados: Record<string, unknown> | null, validarPara = vi.fn()) {
  const lead = { id: 'l1', organizationId: 'org-1', domain: 'commercial', status: LeadStatus.NEW, clientId: 'cli-1', assignedTo: null, customFields: guardados };
  const repo = { findOne: vi.fn().mockResolvedValue(lead), save: vi.fn().mockImplementation(async (valor) => valor) };
  const campos = { validarPara };
  const uso = new UpdateLeadUseCase(
    repo as never, createProcessHistoryDouble(), createLeadCierreDouble(),
    { emit: () => true } as never, createResponsablesDouble([]), campos as never,
  );
  return { uso, repo, campos };
}

describe('campos propios al editar un lead', () => {
  it('mover de etapa sin campos propios no los valida ni los toca', async () => {
    const { uso, repo, campos } = armar({ canal: 'WhatsApp' });
    await uso.execute('l1', { status: LeadStatus.CONTACTED }, 'org-1', 'u1', null);
    expect(campos.validarPara).not.toHaveBeenCalled();
    expect(repo.save.mock.calls[0][0].customFields).toEqual({ canal: 'WhatsApp' });
  });

  it('con campos propios, valida contra lo guardado y exige los obligatorios', async () => {
    const validarPara = vi.fn().mockResolvedValue({ canal: 'WhatsApp', personas: 6 });
    const { uso, repo } = armar({ canal: 'WhatsApp' }, validarPara);
    await uso.execute('l1', { customFields: { personas: '6' } }, 'org-1', 'u1', null);
    // La empresa del lead viaja también: sus campos son los de todas más los suyos.
    expect(validarPara).toHaveBeenCalledWith('org-1', 'lead', { canal: 'WhatsApp' }, { personas: '6' }, true, 'cli-1');
    expect(repo.save.mock.calls[0][0].customFields).toEqual({ canal: 'WhatsApp', personas: 6 });
  });

  it('si la validación falla, no guarda nada', async () => {
    const validarPara = vi.fn().mockRejectedValue(new BadRequestException('Falta completar «RUT»'));
    const { uso, repo } = armar({}, validarPara);
    await expect(uso.execute('l1', { customFields: {} }, 'org-1', 'u1', null)).rejects.toThrow('RUT');
    expect(repo.save).not.toHaveBeenCalled();
  });
});
