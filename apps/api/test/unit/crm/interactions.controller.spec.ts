import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { InteractionsController } from '../../../src/modules/crm/interactions/interactions.controller';

const request = {
  organizationId: 'org-1',
  user: { id: 'user-1', role: 'community_manager' },
} as any;

function setup() {
  const service = {
    create: vi.fn(), findAll: vi.fn(), findOne: vi.fn(), update: vi.fn(), remove: vi.fn(),
    referenceClientId: vi.fn(), effectiveClientId: vi.fn(),
  };
  const accountAccess = {
    allowedClientIds: vi.fn().mockResolvedValue(['client-1']),
    assertClient: vi.fn(),
  };
  const capabilities = { assert: vi.fn() };
  return {
    controller: new InteractionsController(service as any, accountAccess as any, capabilities as any),
    service,
    accountAccess,
    capabilities,
  };
}

describe('InteractionsController · aislamiento por empresa', () => {
  it('lista usando las empresas efectivamente permitidas', async () => {
    const { controller, service } = setup();
    service.findAll.mockResolvedValue({ data: [], total: 0, limit: 50, offset: 0 });

    await controller.findAll({ limit: 50, offset: 0 } as any, request);

    expect(service.findAll).toHaveBeenCalledWith('org-1', 50, 0, undefined, ['client-1'], undefined, { from: undefined, to: undefined });
  });

  it('valida y conserva la empresa elegida por el calendario CRM', async () => {
    const { controller, service, accountAccess, capabilities } = setup();
    service.findAll.mockResolvedValue({ data: [], total: 0, limit: 500, offset: 0 });

    await controller.findAll({ limit: 500, offset: 0, clientId: 'client-1' } as any, request);

    expect(accountAccess.assertClient).toHaveBeenCalledWith('org-1', request.user, 'client-1');
    expect(capabilities.assert).toHaveBeenCalledWith('org-1', 'client-1', 'crm');
    expect(service.findAll).toHaveBeenCalledWith('org-1', 500, 0, undefined, ['client-1'], 'client-1', { from: undefined, to: undefined });
  });

  it('el portal usa la empresa firmada en su sesión aunque manipule el calendario', async () => {
    const { controller, service, accountAccess, capabilities } = setup();
    const portalRequest = {
      organizationId: 'org-1',
      user: { id: 'portal-1', role: 'client', clientId: 'client-1' },
    } as any;
    accountAccess.allowedClientIds.mockResolvedValue(['client-1']);
    service.findAll.mockResolvedValue({ data: [], total: 0, limit: 500, offset: 0 });

    await controller.findAll({ limit: 500, offset: 0, clientId: 'client-2' } as any, portalRequest);

    expect(accountAccess.assertClient).toHaveBeenCalledWith('org-1', portalRequest.user, 'client-1');
    expect(capabilities.assert).toHaveBeenCalledWith('org-1', 'client-1', 'crm');
    expect(service.findAll).toHaveBeenCalledWith('org-1', 500, 0, undefined, ['client-1'], 'client-1', { from: undefined, to: undefined });
  });

  it('no permite a una persona acotada crear actividad general sin empresa', async () => {
    const { controller, service } = setup();
    service.referenceClientId.mockResolvedValue(undefined);

    await expect(controller.create({ type: 'note' } as any, request)).rejects.toThrow(NotFoundException);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('comprueba origen y destino antes de mover referencias al actualizar', async () => {
    const { controller, service, accountAccess } = setup();
    const interaction = { id: 'interaction-1', leadId: 'lead-1' };
    service.findOne.mockResolvedValue(interaction);
    service.effectiveClientId.mockResolvedValueOnce('client-1').mockResolvedValueOnce('client-2');

    await controller.update('interaction-1', { leadId: 'lead-2' } as any, request);

    expect(accountAccess.assertClient).toHaveBeenNthCalledWith(1, 'org-1', request.user, 'client-1');
    expect(accountAccess.assertClient).toHaveBeenNthCalledWith(2, 'org-1', request.user, 'client-2');
    expect(service.update).toHaveBeenCalledWith('interaction-1', { leadId: 'lead-2' }, 'org-1');
  });
});
