import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IsNull } from 'typeorm';
import { SuscriptoresService } from '../../../src/modules/marketing/suscriptores.service';
import { EstadoDeSuscripcion } from '../../../src/modules/marketing/suscriptor.entity';

/*
 * El encierro de la lista cuando quien pregunta es una cuenta de empresa.
 *
 * La empresa ve la suya y ninguna otra. Las filas ya iban acotadas, pero el recuento por empresa
 * salía de la organización entera y viajaba en la misma respuesta: la pantalla no lo dibuja, y aun
 * así ahí se iban los números de las demás. Esconder algo en el navegador no es no haberlo enviado.
 */
function servicio() {
  const consulta = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    addGroupBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn().mockResolvedValue([
      { clientId: 'c-casa', status: EstadoDeSuscripcion.SUSCRITO, cuantos: '3' },
      { clientId: 'c-casa', status: EstadoDeSuscripcion.BAJA, cuantos: '1' },
    ]),
  };
  const repo = {
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
    createQueryBuilder: vi.fn(() => consulta),
  };
  const exclusiones = { find: vi.fn(async () => []) };
  return { srv: new SuscriptoresService(repo as never, exclusiones as never), repo, consulta };
}

describe('la lista de suscriptores por empresa', () => {
  beforeEach(() => vi.clearAllMocks());

  it('encierra las filas en su empresa aunque la dirección pida otra', async () => {
    const { srv, repo } = servicio();

    await srv.listar('org-1', { empresa: 'c-bar', encerradoEn: 'c-casa' });

    const [{ where }] = repo.findAndCount.mock.calls[0];
    expect(where.clientId).toBe('c-casa');
  });

  it('encierra también el recuento, que es por donde se escapaban las demás', async () => {
    const { srv, consulta } = servicio();

    await srv.listar('org-1', { encerradoEn: 'c-casa' });

    expect(consulta.andWhere).toHaveBeenCalledWith('s.client_id = :encerradoEn', { encerradoEn: 'c-casa' });
  });

  it('no encierra nada cuando pregunta el equipo: sigue viéndolas todas', async () => {
    const { srv, repo, consulta } = servicio();

    await srv.listar('org-1', {});

    const [{ where }] = repo.findAndCount.mock.calls[0];
    expect(where.clientId).toBeUndefined();
    expect(consulta.andWhere).not.toHaveBeenCalled();
  });

  it('«agencia» sigue significando la lista sin empresa', async () => {
    const { srv, repo } = servicio();

    await srv.listar('org-1', { empresa: 'agencia' });

    const [{ where }] = repo.findAndCount.mock.calls[0];
    expect(where.clientId).toEqual(IsNull());
  });

  it('devuelve la lista sin tarjetas si el recuento falla, en vez de caerse entera', async () => {
    const { srv, consulta } = servicio();
    consulta.getRawMany.mockRejectedValueOnce(new Error('columna inventada'));

    const resultado = await srv.listar('org-1', {});

    expect(resultado.resumen).toEqual([]);
    expect(resultado.total).toBe(0);
  });
});
