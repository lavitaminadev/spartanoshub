import { createProcessHistoryDouble } from '../../helpers/process-history.double';
import { createLeadCierreDouble } from '../../helpers/lead-cierre.double';
import { describe, expect, it, vi } from 'vitest';
import { UpdateLeadUseCase } from '../../../src/modules/crm/leads/use-cases/update-lead.use-case';
import { LeadStatus } from '../../../src/modules/crm/leads/lead-status.enum';

/**
 * Quién queda como responsable cuando un lead sin dueño avanza de etapa.
 *
 * La asignación deja de ser un paso aparte: mover la tarjeta ya afirma haber trabajado el lead.
 * Estas pruebas fijan a quién alcanza esa regla y a quién no, porque el responsable es lo que
 * reparte la carga del equipo y lo que decide de quién es el trabajo.
 */
function caso(lead: Record<string, unknown>) {
  const repo = {
    findOne: vi.fn().mockResolvedValue(lead),
    save: vi.fn().mockImplementation(async (value) => value),
  };
  const uso = new UpdateLeadUseCase(
    repo as never, createProcessHistoryDouble(), createLeadCierreDouble(), { emit: () => true } as never,
  );
  return { uso, repo };
}

const leadDeLaEmpresa = () => ({
  id: 'l1', domain: 'commercial', status: LeadStatus.NEW, clientId: 'cli-1', assignedTo: null,
});

describe('el dueño de un lead al moverlo de etapa', () => {
  it('lo toma quien lo mueve, si trabaja en la empresa del lead', async () => {
    const { uso } = caso(leadDeLaEmpresa());
    const resultado = await uso.execute('l1', { status: LeadStatus.CONTACTED }, 'org-1', 'usr-1', 'cli-1');
    expect(resultado.assignedTo).toBe('usr-1');
  });

  it('no lo toma quien supervisa desde la agencia', async () => {
    const { uso } = caso(leadDeLaEmpresa());
    const resultado = await uso.execute('l1', { status: LeadStatus.CONTACTED }, 'org-1', 'usr-agencia', null);
    expect(resultado.assignedTo).toBeFalsy();
  });

  it('respeta al responsable que ya tenía', async () => {
    const { uso } = caso({ ...leadDeLaEmpresa(), assignedTo: 'usr-otro' });
    const resultado = await uso.execute('l1', { status: LeadStatus.CONTACTED }, 'org-1', 'usr-1', 'cli-1');
    expect(resultado.assignedTo).toBe('usr-otro');
  });

  it('respeta al responsable elegido a mano en la misma petición', async () => {
    const { uso } = caso(leadDeLaEmpresa());
    const resultado = await uso.execute(
      'l1', { status: LeadStatus.CONTACTED, assignedTo: 'usr-elegido' }, 'org-1', 'usr-1', 'cli-1',
    );
    expect(resultado.assignedTo).toBe('usr-elegido');
  });

  it('guardar sin cambiar de etapa no reparte responsables', async () => {
    const { uso } = caso(leadDeLaEmpresa());
    const resultado = await uso.execute('l1', { notes: 'Llamada sin respuesta' }, 'org-1', 'usr-1', 'cli-1');
    expect(resultado.assignedTo).toBeFalsy();
  });
});
