import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadIntakeService } from '../../../src/modules/crm/leads/lead-intake.service';
import { LeadFitStatus } from '../../../src/modules/crm/leads/lead-fit-status.enum';

/**
 * Un prospecto que escribe una persona no se descarta solo.
 *
 * El scoring comercial mide señales que únicamente existen cuando el lead llega por su cuenta:
 * correo corporativo, campaña de origen, palabras de intención de compra. Quien anota un
 * prospecto desde el tablero no aporta ninguna —escribe un nombre y, con suerte, un teléfono—,
 * así que el puntaje quedaba bajo el umbral y el lead nacía **«Descartado»**.
 *
 * El efecto no era solo la etiqueta: `CrmLeadAutomationService` se salta los descartados, de modo
 * que un prospecto anotado a mano tampoco abría contacto ni oportunidad. El vendedor lo escribía
 * y el sistema lo daba por perdido en el mismo acto.
 *
 * Es el mismo razonamiento que ya eximía a la audiencia: medir con una vara que no aplica no
 * produce una medición baja, produce una medición sin sentido.
 */
const repo = { create: vi.fn(), save: vi.fn(), findOne: vi.fn() };
const audit = { log: vi.fn() };
const automation = { runForLead: vi.fn(), ensureAudienceContact: vi.fn() };

describe('prospecto anotado a mano', () => {
  let service: LeadIntakeService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LeadIntakeService(repo as never, automation as never, audit as never);
    repo.create.mockImplementation((data) => data);
    repo.save.mockImplementation(async (data) => ({ id: 'lead-1', ...data }));
    repo.findOne.mockResolvedValue(null);
    automation.runForLead.mockResolvedValue(undefined);
    automation.ensureAudienceContact.mockResolvedValue(undefined);
    audit.log.mockResolvedValue(undefined);
  });

  it('con solo nombre y correo queda en revisión, no descartado', async () => {
    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Panadería Aurora',
      email: 'aurora@gmail.com',
      enteredByPerson: true,
    });

    expect(lead.fitStatus).toBe(LeadFitStatus.REVIEW);
  });

  it('el mismo prospecto por un origen automático tampoco se descarta solo', async () => {
    /*
     * Antes esta prueba exigía lo contrario: un lead de origen automático con puntaje bajo nacía
     * `unqualified` y con motivo de descarte.
     *
     * Se cambió a propósito. El puntaje mide señales de encaje —correo corporativo, campaña,
     * palabras de intención— y no la voluntad de trabajar a alguien: quien deja su teléfono en
     * una campaña de barrio puntúa bajo y puede ser la venta del mes. Descartar por esa vara
     * sacaba del embudo a gente que nadie había mirado, y el equipo ni siquiera la veía.
     *
     * Descartar vuelve a ser una decisión de una persona. El puntaje se conserva y sirve para
     * ordenar; lo que ya no hace es cerrar la puerta solo.
     */
    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Panadería Aurora',
      email: 'aurora@gmail.com',
    });

    expect(lead.fitStatus).toBe(LeadFitStatus.REVIEW);
    expect(lead.discardReason).toBeFalsy();
  });

  it('sin correo ni teléfono sigue en revisión: el vendedor puede tener solo el nombre', async () => {
    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Ferretería del sur',
      enteredByPerson: true,
    });

    expect(lead.fitStatus).toBe(LeadFitStatus.REVIEW);
  });

  it('no arrastra un motivo de descarte, que se leería como si lo estuviera', async () => {
    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Ferretería del sur',
      enteredByPerson: true,
    });

    expect(lead.discardReason).toBeFalsy();
  });

  it('si el puntaje da para calificado, califica igual: la regla no baja el techo', async () => {
    const lead = await service.captureLead({
      organizationId: 'org-1',
      name: 'Clínica Norte',
      email: 'gerencia@clinicanorte.cl',
      phone: '+56912345678',
      company: 'Clínica Norte',
      source: 'meta_lead_ads',
      campaignName: 'Campaña Marketing Reservas',
      notes: 'Quiere presupuesto para marketing y ads',
      enteredByPerson: true,
    });

    expect(lead.fitStatus).toBe(LeadFitStatus.QUALIFIED);
  });
});
