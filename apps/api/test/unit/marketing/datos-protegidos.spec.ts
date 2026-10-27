import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { nivelesFijos } from '../../../src/core/client-scope/nivel-de-datos.service';
import { SuscriptoresController } from '../../../src/modules/marketing/suscriptores.controller';

const SUSCRIPTOR = { id: 's1', clientId: 'empresa-1', email: 'ana@correo.cl', name: 'Ana', consentAt: new Date('2026-01-01'), source: 'landing', sourceDetail: null, status: 'suscrito' };

function controlador(nivel: 'oculto' | 'bajo_registro' | 'directo') {
  const suscriptores = {
    listar: vi.fn().mockResolvedValue({ data: [{ ...SUSCRIPTOR }], total: 1, resumen: [], origenes: [] }),
    paraDescargar: vi.fn().mockResolvedValue([{ ...SUSCRIPTOR }]),
    buscarParaRevelar: vi.fn().mockResolvedValue({ ...SUSCRIPTOR }),
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const niveles = { nivelesDe: vi.fn().mockResolvedValue(nivelesFijos(nivel)) };
  const controller = new SuscriptoresController(suscriptores as never, {} as never, {} as never, niveles as never, audit as never);
  const req = { organizationId: 'org-1', user: { id: 'user-1', role: 'admin' }, ip: '10.0.0.1' } as never;
  return { controller, audit, req };
}

describe('Marketing: datos protegidos del suscriptor', () => {
  it('con nivel oculto la lista no trae el correo', async () => {
    const { controller, req } = controlador('oculto');
    const lista = await controller.listar(req);
    expect(JSON.stringify(lista)).not.toContain(SUSCRIPTOR.email);
    expect(lista.data[0]).toMatchObject({ name: 'Ana', datosProtegidos: { sePuedePedir: false } });
  });

  it('con directo la lista queda como siempre', async () => {
    const { controller, req } = controlador('directo');
    const lista = await controller.listar(req);
    expect(lista.data[0].email).toBe(SUSCRIPTOR.email);
  });

  it('la descarga sale sin la columna de correo cuando el nivel no es directo', async () => {
    for (const nivel of ['oculto', 'bajo_registro'] as const) {
      const { controller, req } = controlador(nivel);
      const archivo = await controller.descargar(req, 'empresa-1');
      expect(Object.keys(archivo.data[0])).not.toContain('email');
      expect(JSON.stringify(archivo)).not.toContain(SUSCRIPTOR.email);
      expect(archivo.data[0]).toMatchObject({ nombre: 'Ana', origen: 'landing' });
    }
  });

  it('la descarga con directo trae el correo', async () => {
    const { controller, req } = controlador('directo');
    const archivo = await controller.descargar(req, 'empresa-1');
    expect(archivo.data[0].email).toBe(SUSCRIPTOR.email);
  });

  it('pedir ver el correo con bajo_registro deja constancia antes de entregarlo', async () => {
    const { controller, audit, req } = controlador('bajo_registro');
    const respuesta = await controller.datosProtegidos(req, 's1');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1', actorId: 'user-1', entityType: 'email_subscribers', entityId: 's1', action: 'reveal_protected_data',
    }));
    expect(respuesta.datos).toMatchObject({ email: SUSCRIPTOR.email });
  });

  it('con oculto no hay forma de pedirlo y no se anota nada', async () => {
    const { controller, audit, req } = controlador('oculto');
    await expect(controller.datosProtegidos(req, 's1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.log).not.toHaveBeenCalled();
  });
});
