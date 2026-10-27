/**
 * Los ajustes de correo y los permisos propios reciben la empresa ya resuelta.
 *
 * La cuenta de portal alcanza dos empresas, A y B: pedir la segunda responde sobre la segunda, y
 * pedir una que no alcanza da 404 y no la propia. La resolución corre de verdad —interceptor y
 * decorador reales—; sólo se doblan el alcance de la cuenta y los servicios de abajo.
 */

import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { EmpresaInterceptor } from '../../../src/core/client-scope/empresa.interceptor';
import { OrganizationSettingsController } from '../../../src/core/parameters/organization-settings.controller';
import { PermissionsController } from '../../../src/core/authorization/permissions.controller';

const ORG = 'org-1';
const PORTAL = { id: 'u-portal', role: 'client', clientId: 'A', organizationId: ORG };

function accesos(alcanzables: string[] = ['A', 'B']) {
  return {
    allowedClientIds: vi.fn().mockResolvedValue(alcanzables),
    assertClient: vi.fn(async (_org: string, _user: unknown, clientId?: string) => {
      if (clientId && !alcanzables.includes(clientId)) throw new NotFoundException('Client not found');
    }),
  };
}

/** Pasa la petición por el interceptor real y devuelve el contexto con el que corre `@Empresa()`. */
async function conInterceptor(consulta: Record<string, string>) {
  const request: Record<string, unknown> = { user: PORTAL, organizationId: ORG, query: consulta, params: {}, body: {} };
  const contexto = { switchToHttp: () => ({ getRequest: () => request }) } as never;
  await new EmpresaInterceptor(accesos() as never).intercept(contexto, { handle: () => ({}) as never });
  return { request, contexto };
}

function empresaQueRecibe(clase: new (...args: never[]) => unknown, metodo: string, contexto: never) {
  const argumentos = Reflect.getMetadata(ROUTE_ARGS_METADATA, clase, metodo) as Record<string, { factory: Function; data: unknown }>;
  const declarado = Object.values(argumentos).find((arg) => typeof arg.factory === 'function');
  expect(declarado, `${clase.name}.${metodo} no declara @Empresa()`).toBeDefined();
  return declarado!.factory(declarado!.data, contexto);
}

describe('plantillas de correo', () => {
  const controlador = () => {
    const settings = { list: vi.fn().mockResolvedValue([{ key: 'email.reservation_confirmation_subject' }]) };
    const ctrl = new OrganizationSettingsController(
      settings as never,
      { can: vi.fn().mockResolvedValue(true) } as never,
      accesos() as never,
      { tiene: vi.fn().mockResolvedValue(true) } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { ctrl, settings };
  };

  it('una cuenta con dos empresas lee las plantillas de la segunda', async () => {
    const { request, contexto } = await conInterceptor({ clientId: 'B' });
    const ambito = empresaQueRecibe(OrganizationSettingsController, 'correos', contexto);
    const { ctrl, settings } = controlador();
    await ctrl.correos({ ...request } as never, ambito);
    expect(settings.list).toHaveBeenCalledWith(ORG, 'B', null);
  });

  it('pedir una empresa que no alcanza da 404, no las plantillas de la propia', async () => {
    const { contexto } = await conInterceptor({ clientId: 'C' });
    expect(() => empresaQueRecibe(OrganizationSettingsController, 'correos', contexto)).toThrow(NotFoundException);
  });

  it('no declarar empresa teniendo dos da 400 y no la de la cuenta', async () => {
    const { contexto } = await conInterceptor({});
    expect(() => empresaQueRecibe(OrganizationSettingsController, 'guardarCorreos', contexto)).toThrow(BadRequestException);
  });
});

describe('permisos propios', () => {
  const llamar = async (consulta: Record<string, string>) => {
    const { request } = await conInterceptor(consulta);
    const permissionsFor = vi.fn().mockResolvedValue({});
    const ctrl = Object.assign(Object.create(PermissionsController.prototype), {
      permissions: { permissionsFor },
      acciones: { explicar: vi.fn().mockResolvedValue([]) },
      accountAccess: accesos(),
    });
    return { permissionsFor, resultado: ctrl.mine(request, consulta.clientId) };
  };

  it('una cuenta de portal con dos empresas pide los permisos de la segunda', async () => {
    const { permissionsFor, resultado } = await llamar({ clientId: 'B' });
    await resultado;
    expect(permissionsFor).toHaveBeenCalledWith(ORG, 'u-portal', 'client', 'B');
  });

  it('pedir una empresa que no alcanza da 404 y no los permisos de la propia', async () => {
    const { permissionsFor, resultado } = await llamar({ clientId: 'C' });
    await expect(resultado).rejects.toBeInstanceOf(NotFoundException);
    expect(permissionsFor).not.toHaveBeenCalled();
  });
});
