import { describe, expect, it, vi } from 'vitest';
import { CrmLeadAutomationService } from '../../../src/modules/crm/leads/crm-lead-automation.service';
import { LeadFitStatus } from '../../../src/modules/crm/leads/lead-fit-status.enum';

/**
 * Un lead nuevo entra sin responsable.
 *
 * Antes caía sobre la primera dirección comercial activa, y el efecto era que todo lead nacía con
 * dueño sin que nadie lo hubiera tomado: el tablero mostraba una cartera repartida que no existía,
 * y la bandeja de lo que falta repartir estaba vacía por construcción.
 *
 * La oportunidad y la interacción sí llevan autor —necesitan uno— y ese autor sigue siendo quien
 * responde por la cuenta mientras nadie la tome. Son dos cosas distintas y la prueba las separa.
 */
function montar(lead: Record<string, unknown>) {
  const vacio = () => ({
    findOne: vi.fn().mockResolvedValue(null),
    find: vi.fn().mockResolvedValue([]),
    create: vi.fn((valor: unknown) => valor),
    save: vi.fn(async (valor: unknown) => valor),
  });

  const usuarios = {
    ...vacio(),
    findOne: vi.fn().mockResolvedValue({ id: 'direccion-comercial-1' }),
  };


  const servicio = new CrmLeadAutomationService(
    vacio() as never, vacio() as never, vacio() as never, usuarios as never,
  );

  return { servicio, lead, usuarios };
}

const base = {
  id: 'lead-1',
  organizationId: 'org-1',
  clientId: null,
  name: 'Persona de ejemplo',
  email: 'persona@ejemplo.cl',
  phone: null,
  source: 'meta_lead_ads',
  domain: 'commercial',
  assignedTo: null,
  discardReason: null,
};

describe('responsable de un lead nuevo', () => {
  it('no se asigna a nadie al entrar', async () => {
    const { servicio, lead, usuarios } = montar({ ...base, fitStatus: LeadFitStatus.REVIEW });

    await servicio.runForLead(lead as never);

    // Sin esto la prueba pasaria aunque el lead ni siquiera llegara al tramo que asignaba.
    expect(usuarios.findOne).toHaveBeenCalled();
    expect((lead as { assignedTo: unknown }).assignedTo).toBeNull();
  });

  it('tampoco si el lead ya viene calificado', async () => {
    const { servicio, lead } = montar({ ...base, fitStatus: LeadFitStatus.QUALIFIED });

    await servicio.runForLead(lead as never);

    expect((lead as { assignedTo: unknown }).assignedTo).toBeNull();
  });

  it('respeta un responsable que ya traía', async () => {
    // Importar o crear a mano con responsable es una decisión de quien lo hace, no un automatismo.
    const { servicio, lead } = montar({
      ...base, fitStatus: LeadFitStatus.REVIEW, assignedTo: 'persona-elegida',
    });

    await servicio.runForLead(lead as never);

    expect((lead as { assignedTo: unknown }).assignedTo).toBe('persona-elegida');
  });
});
