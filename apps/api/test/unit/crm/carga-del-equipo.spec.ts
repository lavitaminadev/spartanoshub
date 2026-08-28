import { describe, expect, it, vi } from 'vitest';
import { CrmHomeService } from '../../../src/modules/crm/leads/crm-home.service';

/**
 * Cómo se reparte el trabajo dentro de la agencia no es información de la empresa cliente.
 *
 * La carga del equipo dice qué persona de Espartanos lleva cada lead. Se omitía solo para los
 * cargos acotados —los que ven únicamente lo suyo— y el cliente no es uno de ésos: veía la tabla
 * entera, con nombres.
 */
function servicio() {
  const leads = {
    count: vi.fn().mockResolvedValue(0),
    createQueryBuilder: vi.fn(() => {
      const qb: Record<string, unknown> = {};
      for (const metodo of ['select', 'addSelect', 'leftJoin', 'innerJoin', 'where', 'andWhere', 'groupBy', 'orderBy', 'limit', 'setParameters']) {
        qb[metodo] = vi.fn(() => qb);
      }
      qb.getRawMany = vi.fn().mockResolvedValue([{ userId: 'u1', abiertos: '7', sinContactar: '7', enfriandose: '0' }]);
      qb.getRawOne = vi.fn().mockResolvedValue({});
      return qb;
    }),
    find: vi.fn().mockResolvedValue([]),
    findAndCount: vi.fn().mockResolvedValue([[], 0]),
  };
  const users = { find: vi.fn().mockResolvedValue([{ id: 'u1', name: 'Nicolás' }]) };
  return new CrmHomeService(leads as never, users as never);
}

describe('carga del equipo', () => {
  it('no viaja cuando se pide ocultarla', async () => {
    const resultado = await servicio().home('org-1', 7, { clientId: 'empresa-1', ocultarEquipo: true });

    expect(resultado.team).toEqual([]);
  });

  it('viaja cuando no se pide ocultarla', async () => {
    // El equipo interno sí la necesita: es con lo que se nota que alguien está saturado.
    const resultado = await servicio().home('org-1', 7, {});

    expect(resultado.team.length).toBeGreaterThan(0);
  });
});
