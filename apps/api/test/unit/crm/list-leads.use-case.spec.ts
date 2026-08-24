import { describe, expect, it, vi } from 'vitest';
import { ListLeadsUseCase } from '../../../src/modules/crm/leads/use-cases/list-leads.use-case';

function caso() {
  const repo = { findAndCount: vi.fn().mockResolvedValue([[], 0]) };
  return { uso: new ListLeadsUseCase(repo as never), repo };
}

/** El criterio con que se consultó, sea objeto o disyunción. */
function criterio(repo: { findAndCount: { mock: { calls: unknown[][] } } }) {
  return (repo.findAndCount.mock.calls[0][0] as { where: unknown }).where;
}

describe('ListLeadsUseCase · alcance por persona', () => {
  it('sin acotar consulta un solo criterio', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, {});
    expect(Array.isArray(criterio(repo))).toBe(false);
  });

  it('el embudo de la agencia excluye cualquier lead asociado a una empresa', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { domain: 'commercial', agencyOnly: true });
    const donde = criterio(repo) as Record<string, any>;
    expect(donde.domain).toBe('commercial');
    expect(donde.clientId?._type).toBe('isNull');
  });

  it('una persona acotada nunca obtiene el embudo propio de la agencia', async () => {
    const { uso, repo } = caso();
    const resultado = await uso.execute('org-1', 20, 0, {
      domain: 'commercial', agencyOnly: true, allowedClientIds: ['cliente-9'],
    });
    expect(resultado.total).toBe(0);
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });

  it('acotado devuelve lo suyo o lo que no tiene dueño', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { onlyAssignedTo: 'user-7' });
    const donde = criterio(repo) as Array<Record<string, unknown>>;
    expect(donde).toHaveLength(2);
    expect(donde[0].assignedTo).toBe('user-7');
    // La segunda rama es «sin dueño»: se comprueba que no sea el mismo usuario ni quede libre.
    expect(donde[1].assignedTo).not.toBe('user-7');
    expect(donde[1].assignedTo).toBeDefined();
  });

  it('las dos ramas llevan el filtro de empresa completo, o una abriría lo que la otra cierra', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 20, 0, { onlyAssignedTo: 'user-7', clientId: 'cliente-9', domain: 'audience' });
    const donde = criterio(repo) as Array<Record<string, unknown>>;
    for (const rama of donde) {
      expect(rama.organizationId).toBe('org-1');
      expect(rama.clientId).toBe('cliente-9');
      expect(rama.domain).toBe('audience');
    }
  });

  it('sin cuentas permitidas no consulta y devuelve vacío, aunque esté acotado por persona', async () => {
    const { uso, repo } = caso();
    const resultado = await uso.execute('org-1', 20, 0, { onlyAssignedTo: 'user-7', allowedClientIds: [] });
    expect(resultado.total).toBe(0);
    expect(repo.findAndCount).not.toHaveBeenCalled();
  });

  it('busca en base sobre todos los campos sin perder el alcance de empresa', async () => {
    const { uso, repo } = caso();
    await uso.execute('org-1', 100, 0, { clientId: 'cliente-9', domain: 'audience', search: 'ana' });
    const donde = criterio(repo) as Array<Record<string, unknown>>;
    expect(donde).toHaveLength(7);
    for (const rama of donde) {
      expect(rama.organizationId).toBe('org-1');
      expect(rama.clientId).toBe('cliente-9');
      expect(rama.domain).toBe('audience');
    }
    expect(donde.some((rama) => rama.name)).toBe(true);
    expect(donde.some((rama) => rama.email)).toBe(true);
    expect(donde.some((rama) => rama.phone)).toBe(true);
  });
});
