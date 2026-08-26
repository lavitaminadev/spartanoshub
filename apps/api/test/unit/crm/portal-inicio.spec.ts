import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PortalHomeController } from '../../../src/modules/client-portal/portal-home.controller';

/**
 * Qué ve una empresa al abrir su portal.
 *
 * Lo que estas pruebas defienden no es el contenido —eso lo calculan servicios ya probados— sino
 * las dos rejas: **de quién son los datos** y **qué servicios se anuncian**. Un resumen que se
 * equivoque en cualquiera de las dos enseña la casa de otro, o promete algo que no se contrató.
 */
function montar(capacidades: { crm: boolean; reservations: boolean }) {
  const crmHome = {
    home: vi.fn().mockResolvedValue({
      month: { leads: 12 },
      alerts: [
        { key: 'sin_contactar', count: 3, level: 'critico' },
        { key: 'calificados_sin_visita', count: 1, level: 'alto' },
        // Del inicio del equipo, y no es asunto de la empresa: habla del reparto de la agencia.
        { key: 'sin_asignar', count: 9, level: 'critico' },
      ],
    }),
  };
  const capacidadesSvc = {
    tiene: vi.fn().mockImplementation((_org: string, _cliente: string, cual: 'crm' | 'reservations') => (
      Promise.resolve(capacidades[cual])
    )),
  };
  const reservas = { count: vi.fn().mockResolvedValue(4) };

  const controller = new PortalHomeController(crmHome as never, capacidadesSvc as never, reservas as never);
  return { controller, crmHome, reservas };
}

const portal = {
  organizationId: 'org-1',
  user: { role: 'client', clientId: 'empresa-1', id: 'user-1' },
} as never;

describe('inicio del portal', () => {
  it('trae los dos bloques cuando la empresa tiene los dos servicios', async () => {
    const { controller } = montar({ crm: true, reservations: true });

    const inicio = await controller.inicio(portal);

    expect(inicio.crm?.leadsDelMes).toBe(12);
    expect(inicio.reservas).toEqual({ proximasDosDias: 4, sinConfirmar: 4 });
  });

  it('omite el bloque entero de lo no contratado, en vez de mandarlo en cero', async () => {
    // Un cero de algo que no se contrató se lee como que el servicio está roto. La clave ausente
    // permite que la pantalla diga cosas distintas para «no tienes» y «no hay nada».
    const { controller, reservas } = montar({ crm: true, reservations: false });

    const inicio = await controller.inicio(portal);

    expect(inicio.reservas).toBeUndefined();
    expect(reservas.count).not.toHaveBeenCalled();
  });

  it('sin CRM no consulta leads siquiera', async () => {
    const { controller, crmHome } = montar({ crm: false, reservations: true });

    const inicio = await controller.inicio(portal);

    expect(inicio.crm).toBeUndefined();
    expect(crmHome.home).not.toHaveBeenCalled();
  });

  it('acota los leads a la empresa de la sesión y a su embudo', async () => {
    const { controller, crmHome } = montar({ crm: true, reservations: false });

    await controller.inicio(portal);

    expect(crmHome.home).toHaveBeenCalledWith('org-1', 7, { domain: 'commercial', clientId: 'empresa-1' });
  });

  it('no muestra los avisos que hablan del reparto interno de la agencia', async () => {
    const { controller } = montar({ crm: true, reservations: false });

    const inicio = await controller.inicio(portal);

    expect(inicio.crm?.pendientes.map((p) => p.key)).toEqual(['sin_contactar', 'calificados_sin_visita']);
  });

  it('un cargo interno no obtiene este resumen: mira el del equipo', async () => {
    const { controller } = montar({ crm: true, reservations: true });

    await expect(controller.inicio({
      organizationId: 'org-1', user: { role: 'admin', id: 'user-2' },
    } as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('una cuenta cliente sin empresa no puede resolver de quién son los datos', async () => {
    const { controller } = montar({ crm: true, reservations: true });

    await expect(controller.inicio({
      organizationId: 'org-1', user: { role: 'client', clientId: null, id: 'user-3' },
    } as never)).rejects.toBeInstanceOf(ForbiddenException);
  });
});
