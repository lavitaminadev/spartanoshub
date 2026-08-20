import { describe, expect, it, vi } from 'vitest';
import { IsNull } from 'typeorm';
import { AutomationTriggerListener } from '../../../src/modules/automations/automation-trigger.listener';

/**
 * Alcance por cuenta del despachador de automatizaciones.
 *
 * Lo que se comprueba acá no es que la consulta esté escrita de cierta forma, sino qué reglas
 * puede alcanzar un evento: una automatización escrita para una cuenta no debe ejecutarse con
 * los datos de otra, y las transversales deben seguir corriendo como antes de que la columna
 * existiera.
 */
function listenerCon(automatizaciones: Array<Record<string, unknown>> = []) {
  const find = vi.fn().mockResolvedValue(automatizaciones);
  const automations = { find };
  const runs = {
    findOne: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockImplementation(async (value) => value),
    create: vi.fn().mockImplementation((value) => value),
  };
  return { listener: new AutomationTriggerListener(automations as never, runs as never), find, runs };
}

const EVENTO_BASE = { organizationId: 'org-1', opportunityId: 'deal-1', stage: 'negotiation' };

describe('AutomationTriggerListener · alcance por cuenta', () => {
  it('busca las transversales y las de la cuenta del evento, nunca las de otra', async () => {
    const { listener, find } = listenerCon();

    await listener.handleStageChanged({ ...EVENTO_BASE, clientId: 'client-1' });

    // Dos condiciones alternativas, no un `IN` con las dos: una regla sin cuenta vale para
    // todas, y una con cuenta vale solo para la suya.
    expect(find).toHaveBeenCalledWith({
      where: [
        { organizationId: 'org-1', triggerType: 'deal.stage_changed', isActive: true, clientId: IsNull() },
        { organizationId: 'org-1', triggerType: 'deal.stage_changed', isActive: true, clientId: 'client-1' },
      ],
    });
  });

  it('un evento sin cuenta solo alcanza las transversales', async () => {
    const { listener, find } = listenerCon();

    await listener.handleDealCreated(EVENTO_BASE);

    // Sin saber de quién es el trato, ejecutar una regla escrita para un cliente concreto sería
    // adivinar de cuál. Se limita a las que valen para todos.
    expect(find).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', triggerType: 'deal.created', isActive: true, clientId: IsNull() },
    });
  });

  it('encola la regla transversal aunque el evento traiga cuenta', async () => {
    const { listener, runs } = listenerCon([
      { id: 'auto-1', organizationId: 'org-1', clientId: null, version: 1, runAsUserId: 'user-1' },
    ]);

    await listener.handleStageChanged({ ...EVENTO_BASE, clientId: 'client-1' });

    expect(runs.save).toHaveBeenCalledTimes(1);
  });

  it('no encola nada cuando ninguna regla alcanza al evento', async () => {
    const { listener, runs } = listenerCon([]);

    await listener.handleDealWon({ ...EVENTO_BASE, clientId: 'client-9' });

    expect(runs.save).not.toHaveBeenCalled();
  });

  it('no encola cuando el evento no trae el identificador de la entidad', async () => {
    const { listener, find } = listenerCon();

    await listener.handleDealLost({ organizationId: 'org-1', clientId: 'client-1' });

    // Sin trato al que aplicar, no hay nada que ejecutar: ni siquiera se consulta.
    expect(find).not.toHaveBeenCalled();
  });
});
