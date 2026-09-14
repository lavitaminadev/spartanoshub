/**
 * Qué se garantiza: una vista guarda sólo filtros de texto; el portal de una empresa y el equipo
 * interno nunca ven las vistas del otro; y sólo quien creó una vista la comparte o la borra.
 */

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { limpiarFiltros, MAXIMO_VISTAS_POR_LISTA, SavedViewsService } from '../../../src/modules/saved-views/saved-views.service';

const EQUIPO = { id: 'u-equipo', organizationId: 'org-1', role: 'admin', email: 'a@x.cl', name: 'A' } as never;
const PORTAL = { id: 'u-portal', organizationId: 'org-1', role: 'client', clientId: 'cliente-1', email: 'p@x.cl', name: 'P' } as never;

function armar(opciones: { existente?: Record<string, unknown> | null; cuantas?: number; vista?: Record<string, unknown> | null } = {}) {
  const condiciones: Array<[string, Record<string, unknown> | undefined]> = [];
  const qb: Record<string, unknown> = {};
  Object.assign(qb, {
    where: vi.fn((sql: string, p?: Record<string, unknown>) => { condiciones.push([sql, p]); return qb; }),
    andWhere: vi.fn((sql: unknown, p?: Record<string, unknown>) => { condiciones.push([typeof sql === 'string' ? sql : 'brackets', p]); return qb; }),
    orderBy: vi.fn(() => qb),
    take: vi.fn(() => qb),
    getMany: vi.fn().mockResolvedValue([]),
  });
  const repo = {
    createQueryBuilder: vi.fn(() => qb),
    findOne: vi.fn().mockResolvedValue(opciones.existente ?? opciones.vista ?? null),
    count: vi.fn().mockResolvedValue(opciones.cuantas ?? 0),
    create: vi.fn((datos: Record<string, unknown>) => datos),
    save: vi.fn((datos: Record<string, unknown>) => Promise.resolve({ id: 'v-1', ...datos })),
    delete: vi.fn().mockResolvedValue({}),
  };
  return { servicio: new SavedViewsService(repo as never), repo, condiciones };
}

describe('limpiarFiltros', () => {
  it('conserva texto, convierte números y descarta vacíos', () => {
    expect(limpiarFiltros({ status: 'pending', page: 2, search: '', formId: null })).toEqual({ status: 'pending', page: '2' });
  });

  it('rechaza objetos anidados y claves raras', () => {
    expect(() => limpiarFiltros({ status: { $ne: 'x' } })).toThrow(BadRequestException);
    expect(() => limpiarFiltros({ 'a.b': 'x' })).toThrow(BadRequestException);
    expect(() => limpiarFiltros(['x'])).toThrow(BadRequestException);
  });

  it('recorta valores largos', () => {
    expect(limpiarFiltros({ search: 'x'.repeat(500) }).search).toHaveLength(200);
  });
});

describe('SavedViewsService', () => {
  it('el equipo interno sólo ve vistas sin empresa', async () => {
    const { servicio, condiciones } = armar();
    await servicio.listar(EQUIPO, 'reservas.lista');
    expect(condiciones.map(([sql]) => sql)).toContain('v.clientId IS NULL');
  });

  /* Si el portal viera las vistas del equipo, sabría cómo filtra la agencia a sus clientes. */
  it('el portal sólo ve las vistas de su propia empresa', async () => {
    const { servicio, condiciones } = armar();
    await servicio.listar(PORTAL, 'reservas.lista');
    const empresa = condiciones.find(([sql]) => sql === 'v.clientId = :empresa');
    expect(empresa?.[1]).toEqual({ empresa: 'cliente-1' });
  });

  it('rechaza una lista con nombre inventado', async () => {
    const { servicio } = armar();
    await expect(servicio.listar(EQUIPO, 'cualquier cosa; DROP')).rejects.toThrow(BadRequestException);
  });

  it('guarda la vista atada a quien la crea y a su mundo', async () => {
    const { servicio, repo } = armar();
    const vista = await servicio.guardar(PORTAL, { scope: 'reservas.lista', name: '  Hoy  ', filters: { status: 'pending' } });
    expect(vista).toMatchObject({ name: 'Hoy', shared: false, propia: true });
    expect(repo.save.mock.calls[0][0]).toMatchObject({ ownerUserId: 'u-portal', clientId: 'cliente-1', organizationId: 'org-1' });
  });

  it('no deja pasar del tope de vistas por lista', async () => {
    const { servicio } = armar({ cuantas: MAXIMO_VISTAS_POR_LISTA });
    await expect(servicio.guardar(EQUIPO, { scope: 'reservas.lista', name: 'Otra', filters: {} })).rejects.toThrow(BadRequestException);
  });

  it('reemplazar una existente por nombre no cuenta contra el tope', async () => {
    const { servicio } = armar({ existente: { id: 'v-9', ownerUserId: 'u-equipo', shared: true }, cuantas: MAXIMO_VISTAS_POR_LISTA });
    await expect(servicio.guardar(EQUIPO, { scope: 'reservas.lista', name: 'Hoy', filters: {} })).resolves.toMatchObject({ shared: true });
  });

  it('sólo quien la creó la comparte o la borra', async () => {
    const { servicio } = armar({ vista: { id: 'v-1', ownerUserId: 'otra-persona', organizationId: 'org-1' } });
    await expect(servicio.compartir(EQUIPO, 'v-1', true)).rejects.toThrow(ForbiddenException);
    await expect(servicio.borrar(EQUIPO, 'v-1')).rejects.toThrow(ForbiddenException);
  });
});
