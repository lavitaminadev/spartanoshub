import { describe, expect, it, vi } from 'vitest';
import { StageLabelsService } from '../../../src/modules/crm/leads/stage-labels.service';

function servicio(valorGuardado?: Record<string, string>) {
  const definiciones = {
    findOne: vi.fn().mockResolvedValue({ id: 'def-1', key: 'crm.stage_labels' }),
    save: vi.fn(),
    create: vi.fn(),
  };
  const filaExistente = valorGuardado === undefined
    ? null
    : { id: 'val-1', valueJson: { value: valorGuardado }, version: 1 };
  const valores = {
    findOne: vi.fn().mockResolvedValue(filaExistente),
    save: vi.fn().mockImplementation(async (value) => value),
    create: vi.fn().mockImplementation((value) => value),
  };
  return {
    service: new StageLabelsService(definiciones as never, valores as never),
    valores,
  };
}

describe('StageLabelsService', () => {
  it('guarda contra la empresa cuando hay una elegida, y contra la organización cuando no', async () => {
    const conEmpresa = servicio({});
    await conEmpresa.service.set('org-1', 'cliente-9', { new: 'Ingresó' });
    expect(conEmpresa.valores.findOne.mock.calls[0][0].where).toMatchObject({
      scopeType: 'client', scopeId: 'cliente-9',
    });

    const agencia = servicio({});
    await agencia.service.set('org-1', null, { new: 'Ingresó' });
    expect(agencia.valores.findOne.mock.calls[0][0].where).toMatchObject({
      scopeType: 'organization', scopeId: 'org-1',
    });
  });

  it('un rótulo vacío vuelve al de fábrica en vez de guardarse en blanco', async () => {
    const { service } = servicio({ new: 'Ingresó', won: 'Cerrado' });
    const resultado = await service.set('org-1', 'cliente-9', { new: '   ', won: 'Cerrado' });
    expect(resultado).toEqual({ won: 'Cerrado' });
  });

  it('recorta el rótulo para que no desborde la columna del tablero', async () => {
    const { service } = servicio({});
    const largo = 'x'.repeat(80);
    const resultado = await service.set('org-1', null, { new: largo });
    expect(resultado.new).toHaveLength(40);
  });

  it('sin definición todavía creada devuelve vacío en vez de fallar', async () => {
    const definiciones = { findOne: vi.fn().mockResolvedValue(null), save: vi.fn(), create: vi.fn() };
    const valores = { findOne: vi.fn(), save: vi.fn(), create: vi.fn() };
    const service = new StageLabelsService(definiciones as never, valores as never);
    await expect(service.get('org-1', null)).resolves.toEqual({});
    expect(valores.findOne).not.toHaveBeenCalled();
  });
});
