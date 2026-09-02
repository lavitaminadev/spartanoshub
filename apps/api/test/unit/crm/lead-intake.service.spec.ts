import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadIntakeService } from '../../../src/modules/crm/leads/lead-intake.service';
import { LeadFitStatus } from '../../../src/modules/crm/leads/lead-fit-status.enum';
import { RESERVATION_LEAD_SOURCE } from '@espartanos/shared';

const repo = {
  create: vi.fn(),
  save: vi.fn(),
  findOne: vi.fn(),
};

const audit = { log: vi.fn() };

const automation = {
  runForLead: vi.fn(),
  ensureAudienceContact: vi.fn(),
};

describe('LeadIntakeService', () => {
  let service: LeadIntakeService;
  let emisor: { emit: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    emisor = { emit: vi.fn() };

    service = new LeadIntakeService(repo as any, automation as any, audit as any, emisor as any);
    repo.create.mockImplementation((data) => data);
    repo.save.mockImplementation(async (data) => ({ id: data.id ?? 'lead-1', ...data }));
    automation.runForLead.mockResolvedValue(undefined);
    automation.ensureAudienceContact.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);
  });

  it('puntúa alto un lead con contacto y campaña, y lo deja a revisión de una persona', async () => {
    repo.findOne.mockResolvedValue(null);

    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Clínica Norte',
      email: 'gerencia@clinicanorte.cl',
      phone: '+56912345678',
      company: 'Clínica Norte',
      source: 'meta_lead_ads',
      campaignName: 'Campaña Marketing Reservas',
      notes: 'Quiere presupuesto para marketing y ads',
    });

    expect(lead.fitStatus).toBe(LeadFitStatus.REVIEW);
    expect(lead.qualityScore).toBeGreaterThanOrEqual(70);
    expect(automation.runForLead).toHaveBeenCalled();
  });

  it('discards a lead with no valid contact channel', async () => {
    repo.findOne.mockResolvedValue(null);

    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Sin contacto',
      source: 'meta_lead_ads',
      notes: 'Solo dejó una consulta genérica',
    });

    expect(lead.fitStatus).toBe(LeadFitStatus.UNQUALIFIED);
    expect(lead.discardReason).toContain('email');
  });

  it('updates an existing lead when the external lead id already exists', async () => {
    repo.findOne
      .mockResolvedValueOnce({
        id: 'lead-existing',
        organizationId: 'org-1',
        metadata: {},
      });

    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Lead repetido',
      externalLeadId: 'meta-123',
      email: 'contacto@empresa.cl',
      phone: '+56900000000',
      source: 'meta_lead_ads',
    });

    expect(lead.id).toBe('lead-existing');
    expect(repo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'lead-existing' }));
    expect(emisor.emit).not.toHaveBeenCalledWith('lead.created', expect.anything());
  });

  it('emits lead.created once after persisting a genuinely new lead', async () => {
    repo.findOne.mockResolvedValue(null);

    await service.captureLead({
      organizationId: 'org-1', clientId: 'client-1', name: 'Lead nuevo',
      email: 'nuevo@example.cl', source: 'meta_lead_ads',
    });

    expect(emisor.emit).toHaveBeenCalledWith('lead.created', {
      organizationId: 'org-1', leadId: 'lead-1', clientId: 'client-1',
    });
  });

  describe('capturas de audiencia', () => {
    // Una reserva describe a un comensal. El scoring comercial premia el correo corporativo y las
    // palabras del rubro —que el nombre del formulario contiene siempre—, de modo que sin separar
    // el dominio un comensal alcanza el umbral de calificación y abre una oportunidad de venta.
    const diner = {
      organizationId: 'org-1',
      clientId: 'client-1',
      name: 'María Fernández',
      email: 'maria@empresapropia.cl',
      phone: '+56912345678',
      source: RESERVATION_LEAD_SOURCE,
      sourceDetail: 'Reservas Restaurante Del Puerto',
      campaignName: 'Campaña Reservas Restaurante',
      status: 'reserved',
    } as const;

    it('no ejecuta la automatización comercial para una reserva', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.captureLead({ ...diner, domain: 'audience' });

      expect(automation.runForLead).not.toHaveBeenCalled();
      expect(automation.ensureAudienceContact).toHaveBeenCalledTimes(1);
    });

    it('no aplica el scoring comercial a un comensal', async () => {
      repo.findOne.mockResolvedValue(null);

      const lead = await service.captureLead({ ...diner, domain: 'audience' });

      expect(lead.fitStatus).toBe(LeadFitStatus.REVIEW);
      expect(lead.qualityScore).toBe(0);
      expect(lead.discardReason).toBeUndefined();
    });

    it('mantiene el estado de reserva en lugar de sobreescribirlo', async () => {
      repo.findOne.mockResolvedValue(null);

      const lead = await service.captureLead({ ...diner, domain: 'audience' });

      expect(lead.status).toBe('reserved');
    });

    it('persiste el dominio de la captura (migración 0069)', async () => {
      repo.findOne.mockResolvedValue(null);

      const lead = await service.captureLead({ ...diner, domain: 'audience' });

      expect(lead.domain).toBe('audience');
    });

    it('no cambia el dominio de un lead existente al recapturarlo desde otro origen', async () => {
      repo.findOne.mockResolvedValue({ id: 'lead-1', organizationId: 'org-1', domain: 'audience', metadata: {} });

      const lead = await service.captureLead({ ...diner, domain: 'commercial' });

      expect(lead.domain).toBe('audience');
    });

    it('deduplica por teléfono antes que por correo', async () => {
      // El brief define el teléfono como señal primaria dentro del cliente: es obligatorio al
      // reservar, mientras que el correo es opcional y una familia puede compartirlo.
      repo.findOne.mockReset();
      repo.findOne.mockImplementation(async ({ where }: any) => (where?.phone ? { id: 'lead-por-telefono', organizationId: 'org-1', metadata: {} } : null));

      const lead = await service.captureLead({ ...diner, externalLeadId: undefined, domain: 'audience' });

      expect(lead.id).toBe('lead-por-telefono');
      const firstLookup = repo.findOne.mock.calls[0][0].where;
      expect(firstLookup).toHaveProperty('phone');
      expect(firstLookup).not.toHaveProperty('email');
    });

    it('acota la búsqueda al cliente, para no unir comensales de locales distintos', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.captureLead({ ...diner, externalLeadId: undefined, domain: 'audience' });

      expect(repo.findOne.mock.calls[0][0].where).toMatchObject({ clientId: 'client-1' });
    });

    it('devuelve el contacto para que la reserva pueda vincularlo', async () => {
      repo.findOne.mockResolvedValue(null);
      automation.ensureAudienceContact.mockResolvedValue({ id: 'contact-1' });

      const result = await service.captureAudience({
        organizationId: 'org-1',
        clientId: 'client-1',
        name: diner.name,
        phone: diner.phone,
        source: RESERVATION_LEAD_SOURCE,
      });

      expect(result.contact?.id).toBe('contact-1');
      expect(result.lead).toBeDefined();
    });

    it('conserva la automatización comercial cuando no se declara dominio', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.captureLead({
        organizationId: 'org-1',
        name: 'Restaurante Nuevo',
        email: 'gerencia@restaurantenuevo.cl',
        phone: '+56911111111',
        company: 'Restaurante Nuevo',
        source: 'meta_lead_ads',
        notes: 'Pide cotización de campaña',
      });

      expect(automation.runForLead).toHaveBeenCalledTimes(1);
      expect(automation.ensureAudienceContact).not.toHaveBeenCalled();
    });
  });
describe('CRM-05 · sobrescritura de identidad', () => {
    // Este es el camino sin transaccion, que es justo donde faltaba la auditoria: la habian
    // agregado solo a la copia transaccional y aca se seguian pisando datos en silencio.
    it('deja rastro del valor anterior cuando una captura pisa el telefono', async () => {
      repo.findOne.mockResolvedValue({
        id: 'lead-9', organizationId: 'org-1', name: 'Ana Fuentes',
        email: 'ana@example.cl', phone: '+56911111111', domain: 'audience', metadata: {},
      });

      await service.captureAudience({
        organizationId: 'org-1', name: 'Ana Fuentes',
        email: 'ana@example.cl', phone: '+56922222222', source: RESERVATION_LEAD_SOURCE,
      });

      expect(audit.log).toHaveBeenCalledTimes(1);
      const entry = audit.log.mock.calls[0][0];
      expect(entry.action).toBe('identity_overwritten');
      expect(entry.entityId).toBe('lead-9');
      expect(entry.before).toMatchObject({ phone: '+56911111111' });
      expect(entry.after).toMatchObject({ phone: '+56922222222' });
      // Sin usuario detras: atribuirlo a alguien seria peor que dejarlo en blanco.
      expect(entry.actorId).toBeUndefined();
    });

    it('no audita cuando la captura no cambia ningun dato de identidad', async () => {
      repo.findOne.mockResolvedValue({
        id: 'lead-9', organizationId: 'org-1', name: 'Ana Fuentes',
        email: 'ana@example.cl', phone: '+56911111111', domain: 'audience', metadata: {},
      });

      await service.captureAudience({
        organizationId: 'org-1', name: 'Ana Fuentes',
        email: 'ana@example.cl', phone: '+56911111111', source: RESERVATION_LEAD_SOURCE,
      });

      expect(audit.log).not.toHaveBeenCalled();
    });

    it('una captura que falla al auditar no tumba la reserva', async () => {
      repo.findOne.mockResolvedValue({
        id: 'lead-9', organizationId: 'org-1', name: 'Ana Fuentes',
        phone: '+56911111111', domain: 'audience', metadata: {},
      });
      audit.log.mockRejectedValue(new Error('base caida'));

      const lead = await service.captureAudience({
        organizationId: 'org-1', name: 'Ana Fuentes',
        phone: '+56922222222', source: RESERVATION_LEAD_SOURCE,
      });

      expect(lead.lead.phone).toBe('+56922222222');
    });
  });
});
