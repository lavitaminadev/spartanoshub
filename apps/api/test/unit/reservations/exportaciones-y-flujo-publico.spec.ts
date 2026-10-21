import { HttpException, BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { nivelesFijos } from '../../../src/core/client-scope/nivel-de-datos.service';
import { PublicReservationsController } from '../../../src/modules/reservations/public-reservations.controller';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';
import { razonesParaExigirMotivo, tieneRestricciones } from '../../../src/modules/reservations/application/exportaciones';
import { pdfDeTabla } from '../../../src/modules/reservations/application/pdf-de-tabla';
import { respuestaPublicaDeReserva } from '../../../src/modules/reservations/application/respuesta-publica';
import { respuestasFueraDeRango, preguntasContestables } from '../../../src/modules/surveys/validar-respuestas-publicas';
import { createDestinatariosDeAvisosDouble } from '../../helpers/destinatarios-de-avisos.double';

const ACTOR = { id: 'user-1', nombre: 'Marta Soto' };

const FILA = {
  referenceCode: 'R1', guestName: 'Ana Pérez', guestEmail: 'ana@correo.cl', guestPhone: '+56911112222',
  startsAt: new Date('2026-07-22T23:00:00Z'), status: 'confirmed', partySize: 2, internalNotes: 'vip',
  answers: { dietaryNotes: 'alergia al maní', otra: 'mesa en la terraza' },
};

function servicio(items: unknown[] = [FILA]) {
  const consulta = {
    where: vi.fn().mockReturnThis(), andWhere: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(), getMany: vi.fn().mockResolvedValue(items),
  };
  const audit = { log: vi.fn().mockResolvedValue(undefined) };
  const sin = undefined as never;
  const service = new ReservationsService(
    { findOne: vi.fn().mockResolvedValue({ id: 'form-1', name: 'Local Centro', clientId: 'c1', timezone: 'America/Santiago', fieldSchema: [] }) } as never,
    { createQueryBuilder: vi.fn(() => consulta) } as never,
    sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, sin, audit as never, sin, sin, createDestinatariosDeAvisosDouble(),
  );
  (service as unknown as { audit: unknown }).audit = audit;
  vi.spyOn(service, 'getForm').mockResolvedValue({ id: 'form-1', name: 'Local Centro', clientId: 'c1', timezone: 'America/Santiago', fieldSchema: [] } as never);
  return { service, audit };
}

const textoDe = (pdf: Buffer) => pdf.toString('latin1');

describe('Hoja del turno', () => {
  it('no contiene teléfono, correo, alergias ni notas, y avisa que hay restricciones', async () => {
    const { service } = servicio();
    const hoja = await service.hojaDelTurno({ organizationId: 'org-1', formId: 'form-1', fecha: '2026-07-22', actor: ACTOR });
    const texto = textoDe(hoja.cuerpo);

    expect(texto.startsWith('%PDF-')).toBe(true);
    expect(texto).toContain('Ana P'); // el nombre sí
    for (const ausente of ['+56911112222', 'ana@correo.cl', 'mañ', 'alergia', 'terraza', 'vip']) expect(texto).not.toContain(ausente);
    expect(texto).toContain('Tiene restricciones');
    expect(texto).toContain('ver en pantalla');
  });

  it('queda anotada con quién, qué día y cuántas filas', async () => {
    const { service, audit } = servicio();
    await service.hojaDelTurno({ organizationId: 'org-1', formId: 'form-1', fecha: '2026-07-22', actor: ACTOR, ip: '10.0.0.1' });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-1', actorId: 'user-1', action: 'export', ipAddress: '10.0.0.1',
      after: expect.objectContaining({ finalidad: 'hoja_del_turno', formato: 'pdf', filas: 1, filtro: { formId: 'form-1', fecha: '2026-07-22' } }),
    }));
  });

  it('un PDF se abre con su tabla de referencias coherente', () => {
    const pdf = pdfDeTabla({ titulo: 'T', lineas: [], cabeceras: ['A'], filas: [['x (y) \\ z']], anchos: [100], pie: 'p' });
    const texto = textoDe(pdf);
    const inicio = Number(/startxref\n(\d+)/.exec(texto)![1]);
    expect(texto.slice(inicio, inicio + 4)).toBe('xref');
  });
});

describe('Exportación con contacto', () => {
  const base = { organizationId: 'org-1', formId: 'form-1', formato: 'xlsx' as const, dateFrom: '2026-07-01', dateTo: '2026-07-10', fields: ['name', 'phone', 'email'], actor: ACTOR };

  it('sin motivo falla y no entrega ni anota nada', async () => {
    const { service, audit } = servicio();
    await expect(service.exportFormReservations({ ...base, niveles: nivelesFijos('directo') })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.exportFormReservations({ ...base, niveles: nivelesFijos('directo'), motivo: 'corto' })).rejects.toThrow(/motivo escrito/);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('con motivo queda registrada: quién, filtro, filas, columnas y motivo', async () => {
    const { service, audit } = servicio();
    const { cuerpo, filas } = await service.exportFormReservations({ ...base, niveles: nivelesFijos('directo'), motivo: 'Confirmar mesas del fin de semana', ip: '10.0.0.1' });
    expect(filas).toBe(1);
    expect(Buffer.isBuffer(cuerpo)).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'user-1', action: 'export', reason: 'Confirmar mesas del fin de semana',
      after: expect.objectContaining({ finalidad: 'con_contacto', formato: 'xlsx', filas: 1, columnas: expect.arrayContaining(['Teléfono', 'Correo']), filtro: { formId: 'form-1', desde: '2026-07-01', hasta: '2026-07-10' } }),
    }));
  });

  it('la planilla lleva la marca en la primera fila', async () => {
    const { service } = servicio();
    const { cuerpo } = await service.exportFormReservations({ ...base, niveles: nivelesFijos('directo'), motivo: 'Confirmar mesas del fin de semana' });
    // El ZIP va sin comprimir: el XML de la hoja se lee tal cual.
    const texto = (cuerpo as Buffer).toString('utf8');
    expect(texto).toMatch(/Exportado por Marta Soto el .* contiene datos personales . uso interno/);
  });

  it('sin permiso de ver contacto, las columnas salen quitadas y no hace falta motivo en un rango corto', async () => {
    const { service, audit } = servicio();
    const { cuerpo } = await service.exportFormReservations({ ...base, niveles: nivelesFijos('bajo_registro') });
    const texto = (cuerpo as Buffer).toString('utf8');
    expect(texto).not.toContain('+56911112222');
    expect(texto).not.toContain('ana@correo.cl');
    expect(audit.log).toHaveBeenCalledTimes(1);
  });

  it('un rango sin límites o de más de un mes exige motivo aunque no lleve contacto', async () => {
    const { service } = servicio();
    const sinContacto = { ...base, fields: ['name', 'date'], niveles: nivelesFijos('bajo_registro') };
    await expect(service.exportFormReservations({ ...sinContacto, dateFrom: undefined, dateTo: undefined })).rejects.toThrow(/rango/);
    await expect(service.exportFormReservations({ ...sinContacto, dateFrom: '2026-01-01', dateTo: '2026-06-30' })).rejects.toThrow(/31 d/);
  });

  it('el volumen: más de 500 filas exige motivo', () => {
    expect(razonesParaExigirMotivo({ filas: 500, desde: '2026-07-01', hasta: '2026-07-02' }, false)).toEqual([]);
    expect(razonesParaExigirMotivo({ filas: 501, desde: '2026-07-01', hasta: '2026-07-02' }, false)).toEqual([expect.stringContaining('500')]);
  });

  it('si la constancia no se puede escribir, el archivo no sale', async () => {
    const { service, audit } = servicio();
    audit.log.mockRejectedValue(new Error('base caída'));
    await expect(service.exportFormReservations({ ...base, niveles: nivelesFijos('directo'), motivo: 'Confirmar mesas del fin de semana' })).rejects.toThrow('base caída');
  });
});

describe('tieneRestricciones', () => {
  const etiqueta = (clave: string) => clave;
  it('reconoce lo declarado y no lo vacío', () => {
    expect(tieneRestricciones({ dietaryNotes: 'celíaca' }, etiqueta)).toBe(true);
    expect(tieneRestricciones({ campo: 'sin gluten' }, (c) => (c === 'campo' ? 'Alergias o restricciones' : c))).toBe(true);
    expect(tieneRestricciones({ dietaryNotes: 'ninguna' }, etiqueta)).toBe(false);
    expect(tieneRestricciones({ otra: 'terraza' }, etiqueta)).toBe(false);
  });
});

describe('createPublic: la repetición idempotente', () => {
  it('devuelve la misma lista cerrada que la primera respuesta, sin la nota interna', async () => {
    const { service } = servicio();
    const existente = { id: 'res-1', referenceCode: 'ABC', status: 'confirmed', startsAt: new Date(), endsAt: new Date(), partySize: 2, createdAt: new Date(), internalNotes: 'no avisar al cliente', clientIpAddress: '9.9.9.9', answers: { alergia: 'x' }, guestEmail: 'a@b.cl' };
    const form = { id: 'form-1', organizationId: 'org-1', clientId: 'c1', designConfig: {} };
    const privado = service as unknown as Record<string, unknown>;
    privado.publishedForm = vi.fn().mockResolvedValue(form);
    privado.consentTexts = vi.fn().mockReturnValue({});
    privado.clientCapabilities = vi.fn().mockResolvedValue({});
    privado.transaction = (_n: string, fn: (m: unknown) => unknown) => fn({ getRepository: () => ({ findOne: vi.fn().mockResolvedValue(existente) }) });

    const respuesta = await service.createPublic('mi-local', { reservationConsent: true, idempotencyKey: 'k'.repeat(30), guestName: 'Ana', startsAt: new Date().toISOString(), renderedAt: new Date(Date.now() - 20_000).toISOString() } as never);
    const texto = JSON.stringify(respuesta);
    expect(texto).not.toContain('no avisar al cliente');
    expect(texto).not.toContain('9.9.9.9');
    expect(texto).not.toContain('guestEmail');
    expect(Object.keys(respuesta).sort()).toEqual(Object.keys(respuestaPublicaDeReserva(existente as never)).sort());
  });
});

describe('Retenciones de cupo', () => {
  function conRepo(vigentes: number, actual: unknown = null) {
    const { service } = servicio();
    const repo = { findOne: vi.fn().mockResolvedValue(actual), count: vi.fn().mockResolvedValue(vigentes), create: vi.fn((x) => x), save: vi.fn() };
    const privado = service as unknown as Record<string, unknown>;
    privado.publishedForm = vi.fn().mockResolvedValue({ id: 'form-1', timezone: 'UTC', designConfig: {} });
    privado.assertPublicBookingOpen = vi.fn();
    privado.lockClientDay = vi.fn();
    privado.availability = vi.fn().mockResolvedValue({ available: true, endsAt: new Date() });
    privado.transaction = (_n: string, fn: (m: unknown) => unknown) => fn({ getRepository: () => repo });
    return { service, repo };
  }
  const dto = (extra: object = {}) => ({ startsAt: new Date().toISOString(), holdKey: 'h'.repeat(30), renderedAt: new Date(Date.now() - 20_000).toISOString(), ...extra }) as never;

  it('sin renderedAt no retiene', async () => {
    const { service } = conRepo(0);
    await expect(service.holdPublic('mi-local', dto({ renderedAt: undefined }), '1.2.3.4')).rejects.toThrow('Solicitud inválida');
  });

  it('un origen con seis retenciones vigentes no abre otra', async () => {
    const { service, repo } = conRepo(6);
    await expect(service.holdPublic('mi-local', dto(), '1.2.3.4')).rejects.toBeInstanceOf(HttpException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('con cinco abre la sexta, y cambiar de horario reutiliza la suya aunque esté en el tope', async () => {
    const nueva = conRepo(5);
    await nueva.service.holdPublic('mi-local', dto(), '1.2.3.4');
    expect(nueva.repo.save).toHaveBeenCalled();

    const propia = conRepo(6, { id: 'h1', holdKey: 'x' });
    await propia.service.holdPublic('mi-local', dto(), '1.2.3.4');
    expect(propia.repo.save).toHaveBeenCalled();
  });
});

describe('Flujo público: la URL de origen del evento la arma el servidor', () => {
  it('event() y groupRequest() descartan un dominio ajeno', async () => {
    process.env.APP_PUBLIC_URL = 'https://reservas.lavitamina.cl';
    const service = { trackPublicEvent: vi.fn(), createPublicGroupRequest: vi.fn() };
    const controller = new PublicReservationsController(service as never);
    await controller.event('mi-local', { type: 'view', eventSourceUrl: 'https://ajeno.com/x' } as never, '1.1.1.1', 'ua');
    await controller.groupRequest('mi-local', { eventSourceUrl: 'https://ajeno.com/x' } as never, '1.1.1.1', 'ua');
    expect(service.trackPublicEvent.mock.calls[0][1].eventSourceUrl).toBe('https://reservas.lavitamina.cl/book/mi-local');
    expect(service.createPublicGroupRequest.mock.calls[0][1].eventSourceUrl).toBe('https://reservas.lavitamina.cl/book/mi-local');
  });
});

describe('Encuestas públicas: rangos y opciones', () => {
  const preguntas = [
    { id: 'n', type: 'nps', question: 'Recomendarías', required: false },
    { id: 'r', type: 'rating', question: 'Servicio', required: false },
    { id: 'o', type: 'multiple-choice', question: 'Plato', required: false, options: ['Pasta', 'Pizza'] },
    { id: 'vieja', type: 'rating', question: 'Antigua', required: false, archivada: true },
  ] as never;

  it('acepta lo válido', () => {
    expect(respuestasFueraDeRango(preguntas, { n: 10, r: 1, o: 'Pizza' })).toEqual([]);
  });
  it('rechaza fuera de rango, decimales y opciones inexistentes', () => {
    expect(respuestasFueraDeRango(preguntas, { n: 11 })).toHaveLength(1);
    expect(respuestasFueraDeRango(preguntas, { n: -1 })).toHaveLength(1);
    expect(respuestasFueraDeRango(preguntas, { r: 0 })).toHaveLength(1);
    expect(respuestasFueraDeRango(preguntas, { r: 99 })).toHaveLength(1);
    expect(respuestasFueraDeRango(preguntas, { r: 2.5 })).toHaveLength(1);
    expect(respuestasFueraDeRango(preguntas, { o: 'Sushi' })).toHaveLength(1);
  });
  it('las preguntas archivadas no son contestables', () => {
    expect(preguntasContestables(preguntas).map((p) => p.id)).toEqual(['n', 'r', 'o']);
  });
});
