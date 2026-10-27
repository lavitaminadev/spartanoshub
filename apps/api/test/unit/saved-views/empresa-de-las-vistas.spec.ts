/**
 * Qué se garantiza: una vista guardada queda atada a la empresa ya comprobada que recibe, no a la
 * de la cuenta; el portal que pidió una empresa que no alcanza recibe el 404 y no las vistas de la
 * suya; y el equipo guarda sin empresa aunque alcance varias.
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { SavedViewsController } from '../../../src/modules/saved-views/saved-views.controller';
import { SavedViewsService } from '../../../src/modules/saved-views/saved-views.service';
import { EMPRESA_RESUELTA } from '../../../src/core/client-scope/empresa.interceptor';

const PORTAL = { id: 'u-portal', organizationId: 'org-1', role: 'client', clientId: 'cliente-1' };
const peticion = (user: Record<string, unknown>, ambito: unknown) => ({ user, [EMPRESA_RESUELTA]: ambito }) as never;

describe('la empresa de una vista guardada', () => {
  it('queda atada a la empresa recibida, no a la de la cuenta', async () => {
    const repo = {
      findOne: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((d: Record<string, unknown>) => d),
      save: vi.fn((d: Record<string, unknown>) => Promise.resolve({ id: 'v-1', ...d })),
    };
    const servicio = new SavedViewsService(repo as never);
    await servicio.guardar(PORTAL as never, { scope: 'reservas.lista', name: 'Hoy', filters: {} }, 'cliente-2' as never);
    expect(repo.save.mock.calls[0][0]).toMatchObject({ clientId: 'cliente-2' });
  });

  it('el portal que pidió una empresa que no alcanza recibe el 404, no las vistas de la suya', () => {
    const vistas = { listar: vi.fn(), guardar: vi.fn() };
    const controlador = new SavedViewsController(vistas as never);
    const req = peticion(PORTAL, new NotFoundException('Client not found'));
    expect(() => controlador.listar(req, 'reservas.lista')).toThrow(NotFoundException);
    expect(() => controlador.guardar(req, { scope: 'reservas.lista', name: 'Hoy', filters: {} })).toThrow(NotFoundException);
    expect(vistas.listar).not.toHaveBeenCalled();
    expect(vistas.guardar).not.toHaveBeenCalled();
  });

  it('el portal usa la empresa resuelta', () => {
    const vistas = { listar: vi.fn() };
    new SavedViewsController(vistas as never).listar(peticion(PORTAL, 'cliente-2'), 'reservas.lista');
    expect(vistas.listar).toHaveBeenCalledWith(expect.anything(), 'reservas.lista', 'cliente-2');
  });

  it('el equipo con varias empresas no necesita elegir una', () => {
    const vistas = { listar: vi.fn() };
    new SavedViewsController(vistas as never).listar(
      peticion({ id: 'u-eq', role: 'admin' }, new BadRequestException('Elige empresa')), 'reservas.lista',
    );
    expect(vistas.listar).toHaveBeenCalledWith(expect.anything(), 'reservas.lista', null);
  });
});
