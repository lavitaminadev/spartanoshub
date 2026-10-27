/**
 * Qué se garantiza: las campañas trabajan sobre la empresa ya comprobada de la petición. Pedir una
 * que la cuenta no alcanza da 404 y nunca cae a la propia, y una campaña existente se autoriza
 * contra la empresa que ella misma tiene.
 */

import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CampaignsController } from '../../../src/modules/crm/campaigns/campaigns.controller';
import { AGENCIA } from '../../../src/core/client-scope/empresa-resuelta';

const PORTAL_DE_DOS = { id: 'u-1', role: 'client', clientId: 'cli-A', organizationId: 'org-1' };
const req = (user: Record<string, unknown> = PORTAL_DE_DOS) => ({ user, organizationId: 'org-1' }) as never;

function armar(opciones: { alcanzables?: string[]; campana?: Record<string, unknown> } = {}) {
  const campaigns = {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ campaign: {}, token: 't' }),
    update: vi.fn().mockResolvedValue({}),
    remove: vi.fn().mockResolvedValue(undefined),
    findOne: vi.fn().mockResolvedValue(opciones.campana ?? { id: 'c-1', clientId: 'cli-B' }),
  };
  const permitidas = opciones.alcanzables ?? ['cli-A', 'cli-B'];
  const accountAccess = {
    allowedClientIds: vi.fn().mockResolvedValue(permitidas),
    assertClient: vi.fn(async (_org: string, _user: unknown, id: string) => {
      if (!permitidas.includes(id)) throw new NotFoundException('Client not found');
    }),
    // Si el controlador volviera a llamarlo, caería a la empresa de la cuenta como antes.
    empresaDeTrabajo: vi.fn().mockResolvedValue('cli-A'),
  };
  return { controlador: new CampaignsController(campaigns as never, accountAccess as never), campaigns, accountAccess };
}

describe('CampaignsController', () => {
  it('lista la empresa resuelta, no la de la cuenta', async () => {
    const { controlador, campaigns } = armar();
    await controlador.list(req(), 'cli-B' as never);
    expect(campaigns.list).toHaveBeenCalledWith('org-1', 'cli-B');
  });

  it('la agencia entera se lista sin empresa, porque alguien lo declaró', async () => {
    const { controlador, campaigns } = armar();
    await controlador.list(req({ id: 'u-2', role: 'admin' }), AGENCIA);
    expect(campaigns.list).toHaveBeenCalledWith('org-1', undefined);
  });

  it('crea la campaña en la empresa resuelta', async () => {
    const { controlador, campaigns } = armar();
    await controlador.create({ name: 'x' } as never, req(), 'cli-B' as never);
    expect(campaigns.create.mock.calls[0][1]).toMatchObject({ clientId: 'cli-B' });
  });

  /* El doble repliegue: ni empresaDeTrabajo ni el «?? la de la cuenta» deciden ya la empresa. */
  it('no consulta empresaDeTrabajo ni cae a la empresa de la cuenta', async () => {
    const { controlador, accountAccess, campaigns } = armar();
    await controlador.update('c-1', { name: 'x' } as never, req());
    await controlador.remove('c-1', req());
    expect(accountAccess.empresaDeTrabajo).not.toHaveBeenCalled();
    expect(campaigns.update.mock.calls[0][2]).toMatchObject({ clientId: 'cli-B' });
  });

  it('actualizar o borrar una campaña de una empresa que no se alcanza da 404 y no la toca', async () => {
    const { controlador, campaigns } = armar({ alcanzables: ['cli-A'], campana: { id: 'c-1', clientId: 'cli-B' } });
    await expect(controlador.update('c-1', { name: 'x' } as never, req())).rejects.toThrow(NotFoundException);
    await expect(controlador.remove('c-1', req())).rejects.toThrow(NotFoundException);
    expect(campaigns.update).not.toHaveBeenCalled();
    expect(campaigns.remove).not.toHaveBeenCalled();
  });

  it('mover una campaña a una empresa que no se alcanza da 404 y no la deja en la propia', async () => {
    const { controlador, campaigns } = armar();
    await expect(controlador.update('c-1', { clientId: 'cli-Z' } as never, req())).rejects.toThrow(NotFoundException);
    expect(campaigns.update).not.toHaveBeenCalled();
  });

  it('una campaña de la agencia no la alcanza quien tiene límite', async () => {
    const { controlador } = armar({ campana: { id: 'c-1', clientId: null } });
    await expect(controlador.remove('c-1', req())).rejects.toThrow(NotFoundException);
  });
});
