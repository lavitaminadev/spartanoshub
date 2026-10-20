import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { NivelDeDatosService, nivelesFijos } from '../../../src/core/client-scope/nivel-de-datos.service';
import { ReservationsController } from '../../../src/modules/reservations/reservations.controller';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';
import { createDestinatariosDeAvisosDouble } from '../../helpers/destinatarios-de-avisos.double';

const RESERVA = {
  id: '11111111-1111-4111-8111-111111111111', clientId: 'empresa-1', guestName: 'Ana', referenceCode: 'R1',
  guestPhone: '+56911112222', guestEmail: 'ana@correo.cl', guestDocument: '12.345.678-5', birthDate: '1990-01-01',
  answers: { alergias: 'mani' }, partySize: 2, status: 'confirmed',
};

function controlador(nivel: 'oculto' | 'bajo_registro' | 'directo') {
  const service = {
    listReservations: vi.fn().mockResolvedValue({ data: [{ ...RESERVA }], total: 1, page: 1, pageSize: 50, pages: 1 }),
    datosProtegidosDeReserva: vi.fn().mockResolvedValue({
      clientId: 'empresa-1',
      datos: { guestPhone: RESERVA.guestPhone, answers: RESERVA.answers },
    }),
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const accountAccess = { allowedClientIds: vi.fn().mockResolvedValue(undefined) };
  const niveles = { nivelesDe: vi.fn().mockResolvedValue(nivelesFijos(nivel)) };
  const controller = new ReservationsController(
    service as never, accountAccess as never, {} as never, {} as never, audit as never, {} as never, {} as never, niveles as never,
  );
  const req = { organizationId: 'org-1', user: { id: 'user-1', role: 'admin' }, ip: '10.0.0.1' } as never;
  return { controller, service, audit, req };
}

describe('Reservas: datos protegidos en lo que sale del servidor', () => {
  it('con nivel oculto el listado no trae teléfono, correo, documento, nacimiento ni respuestas', async () => {
    const { controller, req } = controlador('oculto');
    const respuesta = await controller.list(req, {} as never);
    const texto = JSON.stringify(respuesta);
    for (const dato of [RESERVA.guestPhone, RESERVA.guestEmail, RESERVA.guestDocument, RESERVA.birthDate, 'mani']) {
      expect(texto).not.toContain(dato);
    }
    expect(respuesta.data[0].guestName).toBe('Ana');
    expect(respuesta.data[0].datosProtegidos).toMatchObject({ sePuedePedir: false });
  });

  it('con bajo_registro también va recortado, pero se puede pedir', async () => {
    const { controller, req } = controlador('bajo_registro');
    const respuesta = await controller.list(req, {} as never);
    expect(JSON.stringify(respuesta)).not.toContain(RESERVA.guestPhone);
    expect(respuesta.data[0].datosProtegidos).toMatchObject({ sePuedePedir: true });
  });

  it('con directo la respuesta queda como siempre', async () => {
    const { controller, req } = controlador('directo');
    const respuesta = await controller.list(req, {} as never);
    expect(respuesta.data[0].guestPhone).toBe(RESERVA.guestPhone);
    expect(respuesta.data[0]).not.toHaveProperty('datosProtegidos');
  });
});

describe('Reservas: pedir ver los datos protegidos', () => {
  it('con bajo_registro deja constancia de quién y de qué reserva antes de entregarlos', async () => {
    const { controller, audit, req } = controlador('bajo_registro');
    const respuesta = await controller.datosProtegidos(req, RESERVA.id);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1', actorId: 'user-1', entityType: 'reservations', entityId: RESERVA.id, action: 'reveal_protected_data',
    }));
    expect(respuesta.datos.guestPhone).toBe(RESERVA.guestPhone);
  });

  it('si la constancia no se puede escribir, el dato no sale', async () => {
    const { controller, audit, req } = controlador('bajo_registro');
    audit.log.mockRejectedValue(new Error('base caída'));
    await expect(controller.datosProtegidos(req, RESERVA.id)).rejects.toThrow('base caída');
  });

  it('con oculto no entrega nada ni anota nada', async () => {
    const { controller, audit, req } = controlador('oculto');
    await expect(controller.datosProtegidos(req, RESERVA.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(audit.log).not.toHaveBeenCalled();
  });
});

describe('Reservas: el CSV sale sin las columnas protegidas', () => {
  function servicioConReservas() {
    const items = [{ referenceCode: 'R1', guestName: 'Ana', guestEmail: 'ana@correo.cl', guestPhone: '+56911112222', startsAt: new Date('2026-07-22T15:00:00Z'), status: 'confirmed', partySize: 2, answers: { alergias: 'mani' } }];
    const consulta = {
      where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), take: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([{ answers: { alergias: 'mani' } }]), getMany: vi.fn().mockResolvedValue(items),
    };
    const sin = undefined as never;
    return new ReservationsService(
      { find: vi.fn().mockResolvedValue([]) } as never, { createQueryBuilder: vi.fn(() => consulta) } as never,
      sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, createDestinatariosDeAvisosDouble(),
    );
  }
  async function csv(nivel: 'oculto' | 'bajo_registro' | 'directo') {
    let texto = '';
    for await (const trozo of servicioConReservas().streamCsv('org-1', nivelesFijos(nivel))) texto += trozo;
    return texto;
  }

  it.each(['oculto', 'bajo_registro'] as const)('con %s no trae teléfono, correo ni respuestas, ni la marca', async (nivel) => {
    const texto = await csv(nivel);
    for (const ausente of ['telefono', 'correo', '+56911112222', 'ana@correo.cl', 'mani', 'alergias', '__protegido__']) {
      expect(texto).not.toContain(ausente);
    }
    expect(texto).toContain('R1');
    expect(texto).toContain('Ana');
  });

  it('con directo trae todo', async () => {
    const texto = await csv('directo');
    expect(texto).toContain('+56911112222');
    expect(texto).toContain('mani');
  });
});

describe('NivelDeDatosService', () => {
  const servicio = (administra: string[]) => new NivelDeDatosService({ empresasQueAdministra: vi.fn().mockResolvedValue(administra) } as never);

  it('quien administra la empresa ve directo; el resto, bajo registro', async () => {
    const niveles = await servicio(['e1']).nivelesDe('org', 'u', 'reservations');
    expect(niveles.de('e1')).toBe('directo');
    expect(niveles.de('e2')).toBe('bajo_registro');
    expect(niveles.de(undefined)).toBe('bajo_registro');
  });

  it('para varias empresas vale la que menos abre, y «todas» no se puede comprobar', async () => {
    const niveles = await servicio(['e1']).nivelesDe('org', 'u', 'reservations');
    expect(niveles.deTodas(['e1'])).toBe('directo');
    expect(niveles.deTodas(['e1', 'e2'])).toBe('bajo_registro');
    expect(niveles.deTodas(undefined)).toBe('bajo_registro');
  });
});
