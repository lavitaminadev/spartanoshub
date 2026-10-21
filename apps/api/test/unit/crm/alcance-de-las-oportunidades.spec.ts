/**
 * El embudo comercial, acotado a las empresas que la cuenta alcanza.
 *
 * Consultar un trato ya respetaba ese alcance; crearlo, editarlo y borrarlo no. Conociendo el id
 * —y un id viaja en cualquier enlace compartido— se podía editar o borrar el trato de otra
 * empresa, y al crear o al editar se podía nombrar cualquier empresa de la organización.
 *
 * Las cuatro operaciones responden 404 fuera de alcance, no 403: confirmar que el trato existe
 * pero está vedado ya dice con quién está negociando la agencia, que es justo lo que se separa.
 */

import { describe, expect, it, vi } from 'vitest';
import { CreateOpportunityUseCase } from '../../../src/modules/crm/opportunities/use-cases/create-opportunity.use-case';
import { GetOpportunityUseCase } from '../../../src/modules/crm/opportunities/use-cases/get-opportunity.use-case';
import { ListOpportunitiesUseCase } from '../../../src/modules/crm/opportunities/use-cases/list-opportunities.use-case';
import { RemoveOpportunityUseCase } from '../../../src/modules/crm/opportunities/use-cases/remove-opportunity.use-case';
import { UpdateOpportunityUseCase } from '../../../src/modules/crm/opportunities/use-cases/update-opportunity.use-case';

const ORG = 'org-1';
/** La cuenta atiende «mía»; «ajena» es de otro ejecutivo. */
const ALCANCE = ['mia'];

function tratoDe(clientId: string) {
  return { id: 'op-1', organizationId: ORG, clientId, name: 'Carta nueva', stage: 'new' };
}

function montar(clientIdDelTrato: string) {
  const repo = {
    findOne: vi.fn().mockResolvedValue(tratoDe(clientIdDelTrato)),
    create: vi.fn((datos: unknown) => datos),
    save: vi.fn(async (datos: unknown) => ({ id: 'op-nueva', ...(datos as object) })),
    remove: vi.fn(async (fila: unknown) => fila),
  };
  const validador = { validate: vi.fn().mockResolvedValue(undefined) };
  const historial = { recordCreated: vi.fn(), recordStageChange: vi.fn(), record: vi.fn() };
  const campos = { validar: vi.fn().mockResolvedValue({}), aplicar: vi.fn().mockResolvedValue({}) };

  const leer = new GetOpportunityUseCase(repo as never);
  return {
    repo,
    leer,
    crear: new CreateOpportunityUseCase(repo as never, validador as never, historial as never),
    editar: new UpdateOpportunityUseCase(repo as never, validador as never, leer, historial as never, campos as never),
    borrar: new RemoveOpportunityUseCase(repo as never, leer),
  };
}

describe('alcance de las oportunidades', () => {
  it('no se borra el trato de una empresa que la cuenta no alcanza', async () => {
    const { borrar, repo } = montar('ajena');

    await expect(borrar.execute('op-1', ORG, ALCANCE)).rejects.toThrow(/not found/i);
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it('se borra el de una empresa que sí alcanza', async () => {
    const { borrar, repo } = montar('mia');

    await borrar.execute('op-1', ORG, ALCANCE);
    expect(repo.remove).toHaveBeenCalled();
  });

  it('no se edita el trato de una empresa que la cuenta no alcanza', async () => {
    const { editar, repo } = montar('ajena');

    await expect(editar.execute('op-1', { name: 'Otro nombre' } as never, ORG, 'u1', ALCANCE)).rejects.toThrow(/not found/i);
    expect(repo.save).not.toHaveBeenCalled();
  });

  /*
   * El caso que la lectura sola no cubre: el trato está al alcance, y la edición lo cede.
   * Dejarlo pasar hace desaparecer el trato de la vista de quien lo movió, sin dejar quién.
   */
  it('una edición no puede ceder el trato a una empresa fuera de alcance', async () => {
    const { editar, repo } = montar('mia');

    await expect(editar.execute('op-1', { clientId: 'ajena' } as never, ORG, 'u1', ALCANCE)).rejects.toThrow(/esa empresa/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('no se crea un trato en una empresa fuera de alcance', async () => {
    const { crear, repo } = montar('mia');

    await expect(crear.execute({ name: 'Carta', clientId: 'ajena' } as never, ORG, 'u1', ALCANCE)).rejects.toThrow(/esa empresa/);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('se crea en una empresa que sí alcanza', async () => {
    const { crear, repo } = montar('mia');

    await crear.execute({ name: 'Carta', clientId: 'mia' } as never, ORG, 'u1', ALCANCE);
    expect(repo.save).toHaveBeenCalled();
  });

  /*
   * El embudo de una empresa a la vez.
   *
   * Sin poder acotarlo, el listado devolvía todas las carteras que la cuenta alcanza y la
   * pantalla las mostraba mezcladas bajo el encabezado de una sola: no es una fuga de permisos
   * —todo era alcanzable— pero es la cartera de una cuenta leída como la de otra.
   */
  it('con empresa elegida, el listado trae sólo su embudo', async () => {
    const repo = { findAndCount: vi.fn().mockResolvedValue([[], 0]) };
    const listar = new ListOpportunitiesUseCase(repo as never);

    await listar.execute(ORG, 20, 0, undefined, ALCANCE, 'mia');

    expect(repo.findAndCount.mock.calls[0][0].where).toMatchObject({ clientId: 'mia' });
  });

  it('sin empresa elegida sigue acotando a lo alcanzable, con los tratos sin empresa', async () => {
    const repo = { findAndCount: vi.fn().mockResolvedValue([[], 0]) };
    const listar = new ListOpportunitiesUseCase(repo as never);

    await listar.execute(ORG, 20, 0, undefined, ALCANCE, undefined);

    // Dos ramas: los del embudo propio de la agencia, que no tienen empresa, y los alcanzables.
    expect(repo.findAndCount.mock.calls[0][0].where).toHaveLength(2);
  });

  /*
   * `undefined` es «sin límite», y es como entra la dirección: no es lo mismo que una lista
   * vacía. Si se confundieran, quitar el alcance a alguien se lo daría entero.
   */
  it('sin alcance declarado no se acota, y con lista vacía no se alcanza nada', async () => {
    const abierto = montar('ajena');
    await expect(abierto.borrar.execute('op-1', ORG, undefined)).resolves.toBeTruthy();

    const cerrado = montar('mia');
    await expect(cerrado.borrar.execute('op-1', ORG, [])).rejects.toThrow(/not found/i);
  });
});
