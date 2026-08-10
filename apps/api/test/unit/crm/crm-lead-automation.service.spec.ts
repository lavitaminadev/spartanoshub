import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CrmLeadAutomationService } from '../../../src/modules/crm/leads/crm-lead-automation.service';

const contacts = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
const opportunities = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
const interactions = { findOne: vi.fn(), create: vi.fn(), save: vi.fn() };
const users = { find: vi.fn(), findOne: vi.fn() };

function build() {
  return new CrmLeadAutomationService(contacts as never, opportunities as never, interactions as never, users as never);
}

/** Lead de audiencia: es el camino que crea y mantiene el vínculo sin pasar por el embudo. */
function audienceLead(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lead-1',
    organizationId: 'org-1',
    clientId: 'client-1',
    name: 'Ana Fuentes',
    email: 'ana@example.cl',
    phone: '+56912345678',
    source: 'vitahub_reservations',
    ...overrides,
  } as never;
}

describe('CrmLeadAutomationService · el vínculo sigue al lead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contacts.create.mockImplementation((data) => data);
    contacts.save.mockImplementation(async (data) => ({ id: 'contact-1', ...data }));
  });

  it('CRM-01 · crea el vínculo con los datos del lead cuando no existe', async () => {
    contacts.findOne.mockResolvedValue(null);

    const contact = await build().ensureAudienceContact(audienceLead());

    expect(contact).toMatchObject({
      leadId: 'lead-1',
      clientId: 'client-1',
      name: 'Ana Fuentes',
      phone: '+56912345678',
    });
  });

  it('CRM-01 · pone al día la copia cuando la identidad del lead cambió', async () => {
    // El caso real: la persona corrige su teléfono en una reserva posterior. El lead se
    // actualiza; antes el contacto se quedaba con el número viejo y los dos registros pasaban
    // a decir cosas distintas de la misma persona.
    contacts.findOne.mockResolvedValue({
      id: 'contact-1', leadId: 'lead-1', name: 'Ana Fuentes',
      email: 'ana@example.cl', phone: '+56911111111',
    });

    const contact = await build().ensureAudienceContact(audienceLead({ phone: '+56922222222' }));

    expect(contact).toMatchObject({ id: 'contact-1', phone: '+56922222222' });
    expect(contacts.save).toHaveBeenCalledTimes(1);
  });

  it('CRM-01 · no escribe cuando la copia ya coincide', async () => {
    contacts.findOne.mockResolvedValue({
      id: 'contact-1', leadId: 'lead-1', name: 'Ana Fuentes',
      email: 'ana@example.cl', phone: '+56912345678',
    });

    await build().ensureAudienceContact(audienceLead());

    expect(contacts.save).not.toHaveBeenCalled();
  });

  it('CRM-01 · refleja que el lead se quedó sin correo, en vez de conservar el viejo', async () => {
    contacts.findOne.mockResolvedValue({
      id: 'contact-1', leadId: 'lead-1', name: 'Ana Fuentes',
      email: 'viejo@example.cl', phone: '+56912345678',
    });

    const contact = await build().ensureAudienceContact(audienceLead({ email: null }));

    expect(contact).toMatchObject({ email: null });
  });

  it('una reserva no abre oportunidad comercial', async () => {
    contacts.findOne.mockResolvedValue(null);

    await build().runForLead(audienceLead());

    expect(opportunities.save).not.toHaveBeenCalled();
    expect(contacts.save).toHaveBeenCalled();
  });
});
