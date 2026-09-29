import { describe, expect, it, vi } from 'vitest';
import { ListUsersUseCase } from '../../../src/modules/users/list-users.use-case';

/*
 * El equipo de una empresa incluye a quien la atiende por asignación.
 *
 * Mostraba sólo las cuentas creadas en ella: quien atiende dos locales salía en uno y en el otro
 * no, aunque entrara y trabajara en los dos.
 */
describe('Equipo de una empresa', () => {
  function armar() {
    const propias = [{ id: 'ana', name: 'Ana', clientId: 'b' }];
    const asignada = { id: 'beto', name: 'Beto', clientId: 'a' };
    const accesos = { find: vi.fn().mockResolvedValue([{ userId: 'beto' }, { userId: 'ana' }]) };
    const repo = {
      find: vi.fn().mockImplementation(async ({ where }: { where: { clientId?: string } }) => (where.clientId ? propias : [asignada])),
      manager: { getRepository: () => accesos },
    };
    return { caso: new ListUsersUseCase(repo as any), repo };
  }

  it('suma a quien la atiende por asignación, sin repetir a nadie', async () => {
    const { caso } = armar();
    const equipo = await caso.execute({ organizationId: 'org', clientId: 'b', incluirAsignados: true });
    expect(equipo.map((persona) => persona.id)).toEqual(['ana', 'beto']);
  });

  it('sin pedirlo, sigue siendo sólo las cuentas de la empresa', async () => {
    const { caso, repo } = armar();
    const equipo = await caso.execute({ organizationId: 'org', clientId: 'b' });
    expect(equipo.map((persona) => persona.id)).toEqual(['ana']);
    expect(repo.find).toHaveBeenCalledTimes(1);
  });
});
