/**
 * El saldo de diseño que ve una empresa en su portal.
 *
 * `budgetVisibility` fue durante tiempo un interruptor que no encendía nada: la ficha lo
 * guardaba y el panel prometía que la empresa vería sus UD, pero ningún lector lo leía. Estas
 * pruebas defienden las dos cosas que pueden volver a romperlo: que el bloque no aparezca sin la
 * capacidad contratada, y que lo disponible se calcule igual que en el motor que decide si una
 * pieza cabe. Si las dos fórmulas se separan, el portal ofrece UD que el motor rechaza.
 */

import { describe, expect, it, vi } from 'vitest';
import { PortalHomeController } from '../../../src/modules/client-portal/portal-home.controller';

const PORTAL = { organizationId: 'org-1', user: { role: 'client', clientId: 'empresa-1', id: 'u1' } } as never;

function montar(capacidades: Record<string, boolean>, presupuesto: Record<string, unknown> | null) {
  const crmHome = { home: vi.fn().mockResolvedValue({ month: { leads: 0 }, alerts: [] }) };
  const capacidadesSvc = { tiene: vi.fn(async (_o: string, _c: string, cual: string) => Boolean(capacidades[cual])) };
  const reservas = { count: vi.fn().mockResolvedValue(0) };
  const accesos = { allowedClientIds: vi.fn(), assertClient: vi.fn() };
  const clientes = { find: vi.fn() };
  const presupuestos = { findOne: vi.fn().mockResolvedValue(presupuesto) };
  const controller = new PortalHomeController(
    crmHome as never, capacidadesSvc as never, reservas as never, accesos as never, clientes as never, presupuestos as never,
  );
  return { controller, presupuestos };
}

describe('saldo de presupuesto en el portal', () => {
  it('sin la capacidad contratada no se consulta el presupuesto ni se anuncia el bloque', async () => {
    const { controller, presupuestos } = montar({ crm: true }, { contracted: 40, reserved: 0, consumed: 0, status: 'open' });

    const inicio = await controller.inicio(PORTAL);

    expect(inicio.presupuesto).toBeUndefined();
    expect(presupuestos.findOne).not.toHaveBeenCalled();
  });

  it('con la capacidad, lo disponible es contratado menos reservado menos consumido', async () => {
    // La misma resta de `reserve-ud.use-case.ts`, que es quien decide si una pieza cabe.
    const { controller, presupuestos } = montar({ budgetVisibility: true }, { contracted: '40.00', reserved: '7.50', consumed: '12.25', status: 'open' });

    const inicio = await controller.inicio(PORTAL);

    expect(inicio.presupuesto).toMatchObject({ contratado: 40, reservado: 7.5, consumido: 12.25, disponible: 20.25, cerrado: false });
    // Sólo el mes en curso de esa empresa: el saldo de otro mes no es el saldo de hoy.
    expect(presupuestos.findOne).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ clientId: 'empresa-1' }),
    }));
  });

  it('un mes sin presupuesto abierto no entrega el bloque, en vez de entregarlo en cero', async () => {
    // Un cero se leería como «se te acabó»; lo que pasa es que todavía no hay nada que contar.
    const { controller } = montar({ budgetVisibility: true }, null);

    expect((await controller.inicio(PORTAL)).presupuesto).toBeUndefined();
  });

  it('un mes cerrado se entrega marcado, para que la pantalla no invite a pedir más', async () => {
    const { controller } = montar({ budgetVisibility: true }, { contracted: 40, reserved: 0, consumed: 40, status: 'closed' });

    expect((await controller.inicio(PORTAL)).presupuesto).toMatchObject({ disponible: 0, cerrado: true });
  });
});
