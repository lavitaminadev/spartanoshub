import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadCreatedEmailListener } from '../../../src/modules/crm/leads/lead-created-email.listener';

const leads = { findOne: vi.fn() };
const users = { find: vi.fn() };
const parameters = { get: vi.fn() };
const email = { send: vi.fn() };

describe('LeadCreatedEmailListener', () => {
  let listener: LeadCreatedEmailListener;

  beforeEach(() => {
    vi.clearAllMocks();
    listener = new LeadCreatedEmailListener(leads as never, users as never, parameters as never, email as never);
    email.send.mockResolvedValue(true);
  });

  it('sends the client template to each active user of the lead client', async () => {
    parameters.get
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce('Lead nuevo: {{lead}} ({{origen}})')
      .mockResolvedValueOnce('Hola {{responsable}}\n\nEntró {{lead}}.');
    leads.findOne.mockResolvedValue({
      id: 'lead-1', name: 'María Soto', email: 'maria@example.cl', phone: '+56911111111',
      source: 'meta_lead_ads', campaignName: 'Reservas primavera', organizationId: 'org-1', clientId: 'client-1',
    });
    users.find.mockResolvedValue([
      { id: 'user-1', name: 'Ana', email: 'ana@cliente.cl' },
      { id: 'user-2', name: 'Bruno', email: 'bruno@cliente.cl' },
    ]);

    await listener.handle({ organizationId: 'org-1', leadId: 'lead-1', clientId: 'client-1' });

    expect(users.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: 'org-1', clientId: 'client-1', isActive: true },
    }));
    expect(email.send).toHaveBeenCalledTimes(2);
    expect(email.send).toHaveBeenCalledWith('ana@cliente.cl', 'Lead nuevo: María Soto (meta lead ads)', expect.stringContaining('Hola Ana'));
    expect(email.send).toHaveBeenCalledWith('bruno@cliente.cl', 'Lead nuevo: María Soto (meta lead ads)', expect.stringContaining('Hola Bruno'));
  });

  it('does nothing when the company disabled the notice', async () => {
    parameters.get.mockResolvedValueOnce(false);

    await listener.handle({ organizationId: 'org-1', leadId: 'lead-1', clientId: 'client-1' });

    expect(leads.findOne).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('does not use an agency recipient when the lead has no client', async () => {
    await listener.handle({ organizationId: 'org-1', leadId: 'lead-1', clientId: null });

    expect(parameters.get).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });
});
