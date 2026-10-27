import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { DetalleDeContactoEnAvisosService, TEXTO_DE_DETALLE_DE_CONTACTO } from '../../../src/modules/clients/detalle-de-contacto-en-avisos';
import { DestinatariosDeAvisosService } from '../../../src/core/notifications/destinatarios-de-avisos.service';
import { DEFAULT_CLIENT_CAPABILITIES } from '../../../src/modules/clients/client-capabilities';

function servicio() {
  const textos = { findOne: vi.fn().mockResolvedValue({ id: 'txt-1', version: 3, title: 't', text: TEXTO_DE_DETALLE_DE_CONTACTO }), save: vi.fn(), create: vi.fn((x) => x) };
  const consentimientos = { save: vi.fn(), create: vi.fn((x) => x) };
  const audit = { log: vi.fn() };
  return { srv: new DetalleDeContactoEnAvisosService(textos as never, consentimientos as never, audit as never), consentimientos, audit };
}
const base = { organizationId: 'org', clientId: 'c1', actorId: 'u1', ip: '1.2.3.4' };

describe('detalleDeContactoEnAvisos', () => {
  it('nace apagada', () => {
    expect(DEFAULT_CLIENT_CAPABILITIES.detalleDeContactoEnAvisos).toBe(false);
  });

  it('operaciones no puede encenderla', async () => {
    const { srv } = servicio();
    await expect(srv.registrarCambio({ ...base, rol: 'operations_director', encender: true, aceptacion: 'txt-1' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('exige aceptar el texto vigente', async () => {
    const { srv } = servicio();
    await expect(srv.registrarCambio({ ...base, rol: 'commercial_director', encender: true })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(srv.registrarCambio({ ...base, rol: 'commercial_director', encender: true, aceptacion: 'otro' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('al encender deja el consentimiento con IP y la auditoría', async () => {
    const { srv, consentimientos, audit } = servicio();
    await srv.registrarCambio({ ...base, rol: 'commercial_director', encender: true, aceptacion: 'txt-1' });
    expect(consentimientos.save).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', granted: true, ipAddress: '1.2.3.4', action: expect.stringContaining('aceptado:v3') }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'detalle_contacto_avisos_encendido', entityId: 'c1' }));
  });

  it('apagarla no exige cargo ni aceptación pero queda registrado', async () => {
    const { srv, audit } = servicio();
    await srv.registrarCambio({ ...base, rol: 'operations_director', encender: false });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'detalle_contacto_avisos_apagado' }));
  });
});

describe('DestinatariosDeAvisosService.conNivelDirecto', () => {
  const con = (filas: unknown) => new DestinatariosDeAvisosService({} as never, { query: vi.fn().mockResolvedValue(filas) } as never);

  it('sólo devuelve cuentas cuyo perfil da directo', async () => {
    const r = await con([
      { email: 'a@x.cl', datos: { reservations: 'directo' } },
      { email: 'b@x.cl', datos: JSON.stringify({ reservations: 'bajo_registro' }) },
      { email: 'c@x.cl', datos: '{roto' },
    ]).conNivelDirecto('o', 'c', 'reservations', ['a@x.cl', 'b@x.cl', 'c@x.cl', 'buzon@x.cl']);
    expect([...r]).toEqual(['a@x.cl']);
  });

  it('si la consulta falla, nadie es directo', async () => {
    const srv = new DestinatariosDeAvisosService({} as never, { query: vi.fn().mockRejectedValue(new Error('x')) } as never);
    expect((await srv.conNivelDirecto('o', 'c', 'reservations', ['a@x.cl'])).size).toBe(0);
  });
});
