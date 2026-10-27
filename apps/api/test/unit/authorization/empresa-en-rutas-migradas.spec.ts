/**
 * Las rutas de aprobaciones, parrillas, reuniones, producción y reportes reciben la empresa ya
 * comprobada por `@Empresa()`.
 *
 * Con una sola empresa por cuenta, replegarse a «la mía» siempre acertaba y ninguna prueba lo
 * notó. Aquí la cuenta alcanza dos: pedir la segunda debe responder sobre la segunda, y pedir una
 * que no alcanza debe dar 404, no la propia.
 *
 * La resolución corre de verdad —el interceptor y el decorador reales—; sólo se doblan el alcance
 * de la cuenta y los casos de uso, que es lo que cada ruta hace con la empresa que recibe.
 */

import 'reflect-metadata';
import { NotFoundException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it, vi } from 'vitest';
import { EmpresaInterceptor } from '../../../src/core/client-scope/empresa.interceptor';
import { ApprovalsController } from '../../../src/modules/approvals/approvals.controller';
import { ContentController } from '../../../src/modules/content/content.controller';
import { MeetingsController } from '../../../src/modules/meetings/meetings.controller';
import { ProductionController } from '../../../src/modules/production/production.controller';
import { ReportingController } from '../../../src/modules/reports/reports.controller';

const ORG = 'org-1';
const PORTAL = { id: 'u-portal', role: 'client', clientId: 'A', organizationId: ORG };

/** Un alcance de dos empresas, A y B: pedir cualquier otra es un 404, como en `assertClient`. */
function accesos(alcanzables: string[] = ['A', 'B']) {
  return {
    allowedClientIds: vi.fn().mockResolvedValue(alcanzables),
    assertClient: vi.fn(async (_org: string, _user: unknown, clientId?: string) => {
      if (clientId && !alcanzables.includes(clientId)) throw new NotFoundException('Client not found');
    }),
  };
}

/**
 * Resuelve la empresa de una petición como lo hace Nest: interceptor primero, decorador después.
 * Devuelve lo que la ruta recibiría en el parámetro `@Empresa()`, o lanza lo que lanzaría.
 */
async function empresaQueRecibe(
  clase: new (...args: never[]) => unknown,
  metodo: string,
  user: Record<string, unknown>,
  consulta: Record<string, string>,
  alcance: ReturnType<typeof accesos>,
) {
  const request: Record<string, unknown> = { user, organizationId: ORG, query: consulta, params: {}, body: {} };
  const contexto = { switchToHttp: () => ({ getRequest: () => request }) } as never;
  await new EmpresaInterceptor(alcance as never).intercept(contexto, { handle: () => ({}) as never });

  const argumentos = Reflect.getMetadata(ROUTE_ARGS_METADATA, clase, metodo) as Record<string, { factory: Function; data: unknown }>;
  const declarado = Object.values(argumentos).find((arg) => typeof arg.factory === 'function');
  expect(declarado, `${clase.name}.${metodo} no declara @Empresa()`).toBeDefined();
  return declarado!.factory(declarado!.data, contexto);
}

describe('rutas migradas a @Empresa()', () => {
  describe('aprobaciones', () => {
    const lista = (ambito: unknown, user = PORTAL) => {
      const listApprovals = { execute: vi.fn().mockResolvedValue([]) };
      const controlador = Object.assign(Object.create(ApprovalsController.prototype), {
        listApprovals,
        accountAccess: accesos(),
      });
      return { listApprovals, llamada: controlador.list({ organizationId: ORG, user }, ambito) };
    };

    it('una cuenta de portal con dos empresas mira la segunda', async () => {
      const ambito = await empresaQueRecibe(ApprovalsController, 'list', PORTAL, { clientId: 'B' }, accesos());
      const { listApprovals, llamada } = lista(ambito);
      await llamada;
      expect(listApprovals.execute).toHaveBeenCalledWith(ORG, 'B', ['A', 'B']);
    });

    it('pedir una empresa que no alcanza da 404, no la propia', async () => {
      await expect(empresaQueRecibe(ApprovalsController, 'list', PORTAL, { clientId: 'C' }, accesos()))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('decidir una solicitud de la segunda empresa entrega esa empresa, no la de la cuenta', async () => {
      const updateStatus = { execute: vi.fn().mockResolvedValue({}) };
      const controlador = Object.assign(Object.create(ApprovalsController.prototype), {
        updateStatus,
        repo: { findOne: vi.fn().mockResolvedValue({ id: 'ap-1', clientId: 'B' }) },
        accountAccess: accesos(),
      });
      await controlador.update('ap-1', { status: 'approved' }, { organizationId: ORG, user: PORTAL });
      expect(updateStatus.execute.mock.calls[0][2]).toMatchObject({ clientId: 'B' });
    });
  });

  describe('parrillas de contenido', () => {
    it('una cuenta de portal con dos empresas mira la segunda', async () => {
      const ambito = await empresaQueRecibe(ContentController, 'list', PORTAL, { clientId: 'B' }, accesos());
      const listGrids = { execute: vi.fn().mockResolvedValue([]) };
      const controlador = Object.assign(Object.create(ContentController.prototype), { listGrids, accountAccess: accesos() });
      await controlador.list(ambito, '2026-10', { organizationId: ORG, user: PORTAL });
      expect(listGrids.execute).toHaveBeenCalledWith(ORG, 'B', '2026-10', true, ['A', 'B']);
    });

    it('pedir una empresa que no alcanza da 404, no la propia', async () => {
      await expect(empresaQueRecibe(ContentController, 'list', PORTAL, { clientId: 'C' }, accesos()))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reuniones', () => {
    it('una cuenta de portal con dos empresas mira la segunda', async () => {
      const ambito = await empresaQueRecibe(MeetingsController, 'list', PORTAL, { clientId: 'B' }, accesos());
      const listMeetings = { execute: vi.fn().mockResolvedValue([]) };
      const controlador = Object.assign(Object.create(MeetingsController.prototype), { listMeetings });
      await controlador.list('', { organizationId: ORG, user: PORTAL }, ambito);
      expect(listMeetings.execute).toHaveBeenCalledWith(ORG, '', 'B', undefined);
    });

    it('pedir una empresa que no alcanza da 404, no la propia', async () => {
      await expect(empresaQueRecibe(MeetingsController, 'list', PORTAL, { clientId: 'C' }, accesos()))
        .rejects.toBeInstanceOf(NotFoundException);
    });

    it('quien lleva cuentas pide una que no lleva y recibe 404, aunque la alcance', async () => {
      const cm = { id: 'cm-1', role: 'community_manager', organizationId: ORG };
      const ambito = await empresaQueRecibe(MeetingsController, 'list', cm, { clientId: 'B' }, accesos());
      const controlador = Object.assign(Object.create(MeetingsController.prototype), {
        listMeetings: { execute: vi.fn() },
        clientRepo: { find: vi.fn().mockResolvedValue([{ id: 'A' }]) },
      });
      await expect(controlador.list('', { organizationId: ORG, user: cm }, ambito)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('producción: rechazar una pieza', () => {
    it('una pieza de la segunda empresa se entrega con esa empresa', async () => {
      const rejectPiece = { execute: vi.fn().mockResolvedValue({}) };
      const controlador = Object.assign(Object.create(ProductionController.prototype), {
        rejectPiece,
        pieceRepo: { findOne: vi.fn().mockResolvedValue({ id: 'p-1', clientId: 'B' }) },
        accountAccess: accesos(),
      });
      await controlador.reject('p-1', { comment: 'x', origin: 'client' }, { organizationId: ORG, user: PORTAL });
      expect(rejectPiece.execute.mock.calls[0][2]).toMatchObject({ clientId: 'B' });
    });

    it('una pieza de una empresa que no alcanza da 404, no la propia', async () => {
      const controlador = Object.assign(Object.create(ProductionController.prototype), {
        rejectPiece: { execute: vi.fn() },
        pieceRepo: { findOne: vi.fn().mockResolvedValue({ id: 'p-9', clientId: 'C' }) },
        accountAccess: accesos(),
      });
      await expect(controlador.reject('p-9', { comment: 'x', origin: 'client' }, { organizationId: ORG, user: PORTAL }))
        .rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('reportes', () => {
    for (const ruta of ['pulse', 'reports', 'performance', 'listMonthlyReports']) {
      it(`${ruta}: pedir una empresa que no alcanza da 404, no la propia`, async () => {
        await expect(empresaQueRecibe(ReportingController, ruta, PORTAL, { clientId: 'C' }, accesos()))
          .rejects.toBeInstanceOf(NotFoundException);
      });
    }

    it('pulse: una cuenta de portal con dos empresas mira la segunda', async () => {
      const ambito = await empresaQueRecibe(ReportingController, 'pulse', PORTAL, { clientId: 'B' }, accesos());
      const pulseService = { getPulse: vi.fn().mockResolvedValue({}) };
      const controlador = Object.assign(Object.create(ReportingController.prototype), { pulseService, accountAccess: accesos() });
      await controlador.pulse({ organizationId: ORG, user: PORTAL }, ambito);
      expect(pulseService.getPulse).toHaveBeenCalledWith(ORG, 'B', ['A', 'B']);
    });

    it('informes mensuales: la segunda empresa llega al servicio', async () => {
      const ambito = await empresaQueRecibe(ReportingController, 'listMonthlyReports', PORTAL, { clientId: 'B' }, accesos());
      const monthlyReports = { list: vi.fn().mockResolvedValue([]) };
      const controlador = Object.assign(Object.create(ReportingController.prototype), { monthlyReports, accountAccess: accesos() });
      await controlador.listMonthlyReports({ organizationId: ORG, user: PORTAL }, undefined, undefined, ambito);
      expect(monthlyReports.list.mock.calls[0][1]).toMatchObject({ clientId: 'B' });
    });
  });
});
