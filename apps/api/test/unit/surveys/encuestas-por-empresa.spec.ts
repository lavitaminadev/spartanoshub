/**
 * Encuestas separadas por empresa: cada persona ve y opera sólo las de sus empresas (más las
 * internas), y una empresa sin el servicio no publica, no envía ni recibe respuestas.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SurveysController } from '../../../src/modules/surveys/surveys.controller';
import { encuestasHabilitadas } from '../../../src/modules/surveys/encuestas-de-la-empresa';

/**
 * Constructor de consulta que anota lo que se le pide.
 *
 * El listado dejó de usar `find` con un `where` declarativo y pasó a un `QueryBuilder`, porque
 * la disyunción de empresas tiene que ir agrupada en paréntesis. Las condiciones se recogen aquí
 * en texto para poder comprobar la reja —qué empresas— y que los filtros de pantalla quedan
 * fuera de la disyunción, que es justo lo que esos paréntesis garantizan.
 */
function constructorQueAnota() {
  const condiciones: string[] = [];
  const parametros: Record<string, unknown> = {};
  const anotar = (condicion: unknown, params?: Record<string, unknown>) => {
    if (typeof condicion === 'function') {
      // `new Brackets(cb)` guarda el callback en `whereFactory`; se ejecuta con un grupo propio
      // para que sus condiciones queden marcadas como agrupadas.
      condicion({ where: grupo.where, orWhere: grupo.orWhere });
    } else if (condicion && typeof condicion === 'object' && 'whereFactory' in (condicion as object)) {
      condiciones.push('(');
      (condicion as { whereFactory: (g: unknown) => void }).whereFactory(grupo);
      condiciones.push(')');
    } else {
      condiciones.push(String(condicion));
    }
    Object.assign(parametros, params ?? {});
    return qb;
  };
  const grupo = {
    where: (condicion: unknown, params?: Record<string, unknown>) => { condiciones.push(`grupo: ${String(condicion)}`); Object.assign(parametros, params ?? {}); return grupo; },
    orWhere: (condicion: unknown, params?: Record<string, unknown>) => { condiciones.push(`grupo: ${String(condicion)}`); Object.assign(parametros, params ?? {}); return grupo; },
  };
  const qb = {
    where: anotar,
    andWhere: anotar,
    orderBy: () => qb,
    skip: () => qb,
    take: () => qb,
    getManyAndCount: async () => [[], 0] as [unknown[], number],
    condiciones,
    parametros,
  };
  return qb;
}

function armar(permitidas: string[] | undefined, capacidades: Record<string, boolean> | null = null) {
  const encuestaAjena = { id: 'e-ajena', organizationId: 'org', clientId: 'empresa-b', title: 'Ajena', type: 'customer', status: 'draft', questions: [], createdAt: new Date(), responseCount: 0 };
  const qb = constructorQueAnota();
  const surveys = { createQueryBuilder: vi.fn(() => qb), findOne: vi.fn().mockResolvedValue(encuestaAjena), save: vi.fn(async (v) => v) };
  const responses = { find: vi.fn().mockResolvedValue([]) };
  const dataSource = { query: vi.fn().mockResolvedValue([{ capabilities: capacidades }]) };
  const accountAccess = { allowedClientIds: vi.fn().mockResolvedValue(permitidas), assertClient: vi.fn() };
  const controlador = new SurveysController(surveys as never, responses as never, dataSource as never, accountAccess as never, {} as never, {} as never, {} as never, {} as never, { nivelesDe: async () => ({ de: () => 'directo', deTodas: () => 'directo' }) } as never);
  const req = { organizationId: 'org', user: { id: 'u1', role: 'community_manager' } } as never;
  return { controlador, surveys, req, qb };
}

describe('encuestas por empresa', () => {
  it('sin empresa elegida, alguien con empresas asignadas ve las suyas y las internas, no todas', async () => {
    const { controlador, req, qb } = armar(['empresa-a']);
    await controlador.list(req, {} as never);

    expect(qb.condiciones).toContain('encuesta.organization_id = :organizationId');
    // Las dos ramas de la disyunción: las internas del equipo y las empresas que alcanza.
    expect(qb.condiciones).toContain('grupo: encuesta.client_id IS NULL');
    expect(qb.condiciones).toContain('grupo: encuesta.client_id IN (:...permitidas)');
    expect(qb.parametros.permitidas).toEqual(['empresa-a']);
    // Y nada que abra la consulta a toda la organización.
    expect(qb.condiciones).not.toContain('encuesta.client_id = :clientId');
  });

  /*
   * El filtro de pantalla va fuera de la disyunción.
   *
   * Dentro, se ataría sólo a la última rama y ensancharía lo que se ve: con «estado = activa»
   * saldrían las internas en cualquier estado. Por eso la disyunción va entre paréntesis.
   */
  it('el filtro de estado se suma al conjunto entero y no a la última rama', async () => {
    const { controlador, req, qb } = armar(['empresa-a']);
    await controlador.list(req, { estado: 'active' } as never);

    const abre = qb.condiciones.indexOf('(');
    const cierra = qb.condiciones.indexOf(')');
    const estado = qb.condiciones.indexOf('encuesta.status = :estado');
    expect(abre).toBeGreaterThanOrEqual(0);
    expect(cierra).toBeGreaterThan(abre);
    expect(estado).toBeGreaterThan(cierra);
    expect(qb.parametros.estado).toBe('active');
  });

  it('no deja ver resultados ni editar la encuesta de otra empresa', async () => {
    const { controlador, req } = armar(['empresa-a']);
    await expect(controlador.results(req, 'e-ajena')).rejects.toBeInstanceOf(NotFoundException);
    await expect(controlador.update(req, 'e-ajena', { title: 'X' } as never)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('quien no tiene límite de empresas sí la alcanza', async () => {
    const { controlador, req } = armar(undefined);
    await expect(controlador.detail(req, 'e-ajena')).resolves.toMatchObject({ id: 'e-ajena' });
  });

  it('no publica una encuesta de una empresa sin Encuestas', async () => {
    const { controlador, req } = armar(undefined, { surveys: false });
    await expect(controlador.update(req, 'e-ajena', { status: 'active' } as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('una empresa sin capacidades guardadas tiene Encuestas, como CRM y Reservas', async () => {
    await expect(encuestasHabilitadas({ query: vi.fn().mockResolvedValue([{ capabilities: null }]) }, 'x')).resolves.toBe(true);
    await expect(encuestasHabilitadas({ query: vi.fn().mockResolvedValue([{ capabilities: '{"surveys":false}' }]) }, 'x')).resolves.toBe(false);
    await expect(encuestasHabilitadas({ query: vi.fn() }, null)).resolves.toBe(true);
  });
});
