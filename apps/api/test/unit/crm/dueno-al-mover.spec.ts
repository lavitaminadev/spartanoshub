import { createProcessHistoryDouble } from '../../helpers/process-history.double';
import { createLeadCierreDouble } from '../../helpers/lead-cierre.double';
import { createResponsablesDouble } from '../../helpers/responsables-del-crm.double';
import { describe, expect, it, vi } from 'vitest';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
import { createAutomatizacionDouble } from '../../helpers/crm-lead-automation.double';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';

/**
 * Quién queda como responsable cuando un lead sin dueño avanza de etapa.
 *
 * La regla existe para la empresa que atiende su CRM con una sola persona: ahí elegir
 * responsable es escoger de una lista de uno, y el lead se queda sin dueño por pura fricción.
 * Con equipo se retira, porque el reparto pasa a ser una decisión con consecuencias —el perfil
 * de venta solo ve lo suyo— y el CRM ya ofrece «Tomar» para hacerla explícita.
 */
function caso(lead: Record<string, unknown>, equipo: { id: string; name: string }[] = []) {
  const repo = {
    findOne: vi.fn().mockResolvedValue(lead),
    save: vi.fn().mockImplementation(async (value) => value),
  };
  const uso = new UpdateLeadUseCase(
    repo as never, createProcessHistoryDouble(), createLeadCierreDouble(),
    { emit: () => true } as never, createResponsablesDouble(equipo), undefined as never, createAutomatizacionDouble() as never,
  );
  return { uso, repo };
}

const leadDeLaEmpresa = () => ({
  id: 'l1', domain: 'commercial', status: LeadStatus.NEW, clientId: 'cli-1', assignedTo: null,
});
const solaEnLaEmpresa = [{ id: 'usr-1', name: 'Única' }];
const conEquipo = [{ id: 'usr-1', name: 'Una' }, { id: 'usr-2', name: 'Otra' }];

describe('el dueño de un lead al moverlo de etapa', () => {
  it('lo toma quien lo mueve, si es la única persona que puede atenderlo', async () => {
    const { uso } = caso(leadDeLaEmpresa(), solaEnLaEmpresa);
    const resultado = await uso.execute('l1', { status: LeadStatus.CONTACTED }, 'org-1', 'usr-1');
    expect(resultado.assignedTo).toBe('usr-1');
  });

  it('no reparte nada cuando la empresa tiene equipo', async () => {
    const { uso } = caso(leadDeLaEmpresa(), conEquipo);
    const resultado = await uso.execute('l1', { status: LeadStatus.CONTACTED }, 'org-1', 'usr-1');
    expect(resultado.assignedTo).toBeFalsy();
  });

  /*
   * Lo que lo garantiza es la propia lista de responsables: son las cuentas cuya empresa es la
   * del lead, así que una cuenta de la agencia no figura en ella y no puede ser «la única».
   * Había además una comprobación aparte de pertenencia, y resultaba ser otra cosa según el
   * papel: para una cuenta de empresa se le pasaba la empresa del lead, de modo que se comparaba
   * consigo misma; para el equipo interno, algo que nunca existe. No añadía ninguna reja.
   */
  it('no lo toma quien supervisa desde la agencia', async () => {
    const { uso } = caso(leadDeLaEmpresa(), solaEnLaEmpresa);
    const resultado = await uso.execute('l1', { status: LeadStatus.CONTACTED }, 'org-1', 'usr-agencia');
    expect(resultado.assignedTo).toBeFalsy();
  });

  it('respeta al responsable que ya tenía', async () => {
    const { uso } = caso({ ...leadDeLaEmpresa(), assignedTo: 'usr-otro' }, solaEnLaEmpresa);
    const resultado = await uso.execute('l1', { status: LeadStatus.CONTACTED }, 'org-1', 'usr-1');
    expect(resultado.assignedTo).toBe('usr-otro');
  });

  it('respeta al responsable elegido a mano en la misma petición', async () => {
    const { uso } = caso(leadDeLaEmpresa(), conEquipo);
    const resultado = await uso.execute(
      'l1', { status: LeadStatus.CONTACTED, assignedTo: 'usr-elegido' }, 'org-1', 'usr-1',
    );
    expect(resultado.assignedTo).toBe('usr-elegido');
  });

  it('guardar sin cambiar de etapa no reparte responsables', async () => {
    const { uso } = caso(leadDeLaEmpresa(), solaEnLaEmpresa);
    const resultado = await uso.execute('l1', { notes: 'Llamada sin respuesta' }, 'org-1', 'usr-1');
    expect(resultado.assignedTo).toBeFalsy();
  });
});
