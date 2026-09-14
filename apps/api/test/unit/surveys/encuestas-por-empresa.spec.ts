/**
 * Encuestas separadas por empresa: cada persona ve y opera sólo las de sus empresas (más las
 * internas), y una empresa sin el servicio no publica, no envía ni recibe respuestas.
 */

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SurveysController } from '../../../src/modules/surveys/surveys.controller';
import { encuestasHabilitadas } from '../../../src/modules/surveys/encuestas-de-la-empresa';

function armar(permitidas: string[] | undefined, capacidades: Record<string, boolean> | null = null) {
  const encuestaAjena = { id: 'e-ajena', organizationId: 'org', clientId: 'empresa-b', title: 'Ajena', type: 'customer', status: 'draft', questions: [], createdAt: new Date(), responseCount: 0 };
  const surveys = { find: vi.fn().mockResolvedValue([]), findOne: vi.fn().mockResolvedValue(encuestaAjena), save: vi.fn(async (v) => v) };
  const responses = { find: vi.fn().mockResolvedValue([]) };
  const dataSource = { query: vi.fn().mockResolvedValue([{ capabilities: capacidades }]) };
  const accountAccess = { allowedClientIds: vi.fn().mockResolvedValue(permitidas), assertClient: vi.fn() };
  const controlador = new SurveysController(surveys as never, responses as never, dataSource as never, accountAccess as never, {} as never);
  const req = { organizationId: 'org', user: { id: 'u1', role: 'community_manager' } } as never;
  return { controlador, surveys, req };
}

describe('encuestas por empresa', () => {
  it('sin empresa elegida, alguien con empresas asignadas ve las suyas y las internas, no todas', async () => {
    const { controlador, surveys, req } = armar(['empresa-a']);
    await controlador.list(req);
    const where = surveys.find.mock.calls[0][0].where;
    expect(Array.isArray(where)).toBe(true);
    expect(where).toHaveLength(2);
    expect(where[1].clientId._value ?? where[1].clientId.value).toEqual(['empresa-a']);
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
