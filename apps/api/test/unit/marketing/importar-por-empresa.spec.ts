import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IsNull } from 'typeorm';
import { SuscriptoresService } from '../../../src/modules/marketing/suscriptores.service';
import { EstadoDeSuscripcion } from '../../../src/modules/marketing/suscriptor.entity';

/*
 * Importar un archivo, con las mismas rejas que tiene todo lo demás.
 *
 * Eran dos las que faltaban. La ficha se buscaba por organización y no por empresa, así que
 * importar la lista de un local pisaba la del vecino y una baja allí bloqueaba el alta acá; y la
 * exclusión no se consultaba nunca, con lo que un archivo deshacía en silencio lo que una persona
 * había pedido expresamente. El alta desde una reserva ya se guardaba de las dos cosas.
 */
function servicio(fichas: Array<Record<string, unknown>> = [], exclusiones: string[] = []) {
  const repo = {
    findOne: vi.fn(async ({ where }: { where: Record<string, unknown> }) => fichas.find((f) =>
      f.email === where.email && f.clientId === (where.clientId === IsNull() ? null : where.clientId)) ?? null),
    create: vi.fn((fila: Record<string, unknown>) => fila),
    save: vi.fn(async (fila: Record<string, unknown>) => fila),
  };
  const listaExclusion = {
    // Una huella por dirección excluida; el servicio la calcula, así que aquí basta con devolverlas.
    find: vi.fn(async () => exclusiones.map((clientId) => ({ clientId }))),
  };
  return { srv: new SuscriptoresService(repo as never, listaExclusion as never), repo };
}

const csv = 'correo,nombre,acepta\nana@correo.cl,Ana,sí';

describe('importar una lista', () => {
  beforeEach(() => vi.clearAllMocks());

  it('busca la ficha dentro de la empresa, no en toda la organización', async () => {
    const { srv, repo } = servicio();

    await srv.importarCsv('org-1', csv, 'csv_evento', undefined, undefined, 'c-casa');

    const [{ where }] = repo.findOne.mock.calls[0];
    expect(where.clientId).toBe('c-casa');
  });

  it('sin empresa busca la ficha de la agencia, que es la que no tiene', async () => {
    const { srv, repo } = servicio();

    await srv.importarCsv('org-1', csv, 'csv_evento');

    const [{ where }] = repo.findOne.mock.calls[0];
    expect(where.clientId).toEqual(IsNull());
  });

  it('una baja en un local no impide el alta en otro', async () => {
    // La misma dirección, de baja en «casa». Importar la lista de «bar» tiene que crearla allí.
    const { srv, repo } = servicio([
      { email: 'ana@correo.cl', clientId: 'c-casa', status: EstadoDeSuscripcion.BAJA },
    ]);

    const resultado = await srv.importarCsv('org-1', csv, 'csv_evento', undefined, undefined, 'c-bar');

    expect(resultado.creados).toBe(1);
    expect(resultado.respetadosDeBaja).toBe(0);
    expect(repo.create.mock.calls[0][0].clientId).toBe('c-bar');
  });

  it('un archivo no levanta lo que una persona pidió: no entra y se cuenta aparte', async () => {
    const { srv, repo } = servicio([], ['c-casa']);

    const resultado = await srv.importarCsv('org-1', csv, 'csv_evento', undefined, undefined, 'c-casa');

    expect(resultado.excluidos).toBe(1);
    expect(resultado.creados).toBe(0);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('la exclusión de «todas» alcanza aunque se importe a una empresa concreta', async () => {
    // Una fila de exclusión sin empresa significa «de ninguna»: vale para cualquier destino.
    const { srv } = servicio([], [null as unknown as string]);

    const resultado = await srv.importarCsv('org-1', csv, 'csv_evento', undefined, undefined, 'c-bar');

    expect(resultado.excluidos).toBe(1);
  });

  it('a quien no pidió nada se le crea la ficha con su procedencia', async () => {
    const { srv, repo } = servicio();

    const resultado = await srv.importarCsv('org-1', csv, 'landing_verano', 'Formulario de marzo', 'Quiero novedades');

    expect(resultado.creados).toBe(1);
    const creada = repo.create.mock.calls[0][0];
    expect(creada.source).toBe('landing_verano');
    expect(creada.sourceDetail).toBe('Formulario de marzo');
    expect(creada.status).toBe(EstadoDeSuscripcion.SUSCRITO);
    expect(creada.consentText).toBe('Quiero novedades');
  });
});
