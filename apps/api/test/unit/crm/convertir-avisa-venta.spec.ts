import { describe, expect, it, vi } from 'vitest';
import { ConvertLeadUseCase } from '../../../src/modules/crm/leads/use-cases/convert-lead.use-case';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';

/**
 * Cerrar convirtiendo en cliente también es una venta, y Meta tiene que enterarse.
 *
 * Este camino ponía «Venta» con un guardado directo, sin pasar por el caso de uso que anuncia el
 * cambio de etapa. Quien cerraba así —que es como cierra el equipo comercial— dejaba a Meta sin
 * la señal que más pesa: veía leads que llegaban a Negociación y desaparecían.
 */
function caso(lead: Record<string, unknown>) {
  const guardados: Record<string, unknown>[] = [];
  const manager = {
    create: vi.fn((_entidad: unknown, valor: Record<string, unknown>) => valor),
    findOne: vi.fn(async (entidad: unknown, opciones: { where?: { name?: string } }) => (
      opciones?.where?.name !== undefined ? null : lead
    )),
    save: vi.fn(async (_entidad: unknown, valor: Record<string, unknown>) => {
      guardados.push(valor);
      return { ...valor, id: valor.id ?? 'cliente-1' };
    }),
  };
  const leadRepo = { manager: { transaction: vi.fn(async (run: (m: unknown) => Promise<unknown>) => run(manager)) } };
  const eventEmitter = { emit: vi.fn() };
  return {
    uso: new ConvertLeadUseCase(leadRepo as never, {} as never, eventEmitter as never),
    eventEmitter,
  };
}

const base = {
  id: 'lead-1', organizationId: 'org-1', name: 'Prospecto', clientId: null,
  convertedToClientId: null, status: LeadStatus.NEGOTIATION,
};

describe('convertir un lead en empresa cliente', () => {
  it('anuncia la venta', async () => {
    // Cerrar convirtiendo en cliente es como cierra el equipo comercial. Sin este aviso, Meta veía
    // leads que llegaban a Negociación y desaparecían, y aprendía que esa campaña no convierte.
    const { uso, eventEmitter } = caso({ ...base });

    await uso.execute('lead-1', 'org-1');

    const venta = eventEmitter.emit.mock.calls.find(([nombre]) => nombre === 'lead.won');
    expect(venta).toBeDefined();
    expect(venta?.[1].leadId).toBe('lead-1');
  });

  it('no lo repite si el lead ya estaba en Venta', async () => {
    // El identificador por etapa lo deduplicaría igualmente, pero encolar un evento que se sabe
    // repetido ensucia la cola y el diagnóstico.
    const { uso, eventEmitter } = caso({ ...base, status: LeadStatus.WON });

    await uso.execute('lead-1', 'org-1');

    expect(eventEmitter.emit.mock.calls.some(([nombre]) => nombre === 'lead.won')).toBe(false);
  });

  it('sigue anunciando la conversión, que es otra cosa', async () => {
    // Son dos hechos distintos: el lead se cerró, y además nació una empresa cliente.
    const { uso, eventEmitter } = caso({ ...base });

    await uso.execute('lead-1', 'org-1');

    expect(eventEmitter.emit.mock.calls.some(([nombre]) => nombre === 'lead.converted')).toBe(true);
  });
});
