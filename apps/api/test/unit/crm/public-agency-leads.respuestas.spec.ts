import { describe, expect, it, vi } from 'vitest';
import { PublicAgencyLeadsController } from '../../../src/modules/crm/leads/public-agency-leads.controller';

/**
 * Un formulario externo —una automatización, la web— manda sus preguntas tal como las escribió
 * quien lo armó. Las que un campo propio reclama se guardan en el campo; el resto se anexa al
 * mensaje, para no perder nada de lo que la persona escribió.
 */
describe('captura pública: preguntas y respuestas', () => {
  const definiciones = [
    { id: 'f1', entity: 'lead', key: 'presupuesto_mensual', label: 'Presupuesto', type: 'number', options: null, required: false, position: 0, archivedAt: null, metaQuestions: ['¿Cuál es tu presupuesto?'] },
  ];

  function armar() {
    const leadIntake = { captureLead: vi.fn().mockResolvedValue({ lead: { id: 'l1' } }) };
    const campos = { listar: vi.fn().mockResolvedValue(definiciones) };
    const controller = new PublicAgencyLeadsController(leadIntake as never, campos as never);
    process.env.AGENCY_ORGANIZATION_ID = 'org-1';
    return { controller, leadIntake };
  }

  const envio = (respuestas: Array<{ pregunta: string; respuesta: string }>) => ({
    name: 'Ana Soto',
    email: 'ana@correo.cl',
    message: 'Quiero cotizar',
    respuestas,
    consent: { privacyAccepted: true },
    idempotencyKey: 'abcdefghijklmnop',
  }) as never;

  it('lo que un campo reclama se guarda en el campo', async () => {
    const { controller, leadIntake } = armar();
    await controller.submit(envio([{ pregunta: 'Cual es tu presupuesto', respuesta: '$500.000' }]), '1.2.3.4', 'Mozilla');
    expect(leadIntake.captureLead.mock.calls[0][0].customFields).toEqual({ presupuesto_mensual: 500000 });
  });

  it('lo que ningún campo reclama se anexa al mensaje y no se pierde', async () => {
    const { controller, leadIntake } = armar();
    await controller.submit(envio([{ pregunta: '¿Cuándo empezar?', respuesta: 'Este mes' }]), '1.2.3.4', 'Mozilla');
    const captura = leadIntake.captureLead.mock.calls[0][0];
    expect(captura.customFields).toBeUndefined();
    expect(captura.notes).toContain('¿Cuándo empezar?: Este mes');
  });

  it('sin respuestas se comporta como siempre', async () => {
    const { controller, leadIntake } = armar();
    await controller.submit(envio([]), '1.2.3.4', 'Mozilla');
    expect(leadIntake.captureLead.mock.calls[0][0].notes).toBe('Quiero cotizar');
  });
});
