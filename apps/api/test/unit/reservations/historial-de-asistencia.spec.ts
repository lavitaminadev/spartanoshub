import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { nivelesFijos } from '../../../src/core/client-scope/nivel-de-datos.service';
import { ReservationsController } from '../../../src/modules/reservations/reservations.controller';
import { ReservationsService } from '../../../src/modules/reservations/application/reservations.service';
import { noShowPorLocalYDia, resumirAsistenciaDelComensal } from '../../../src/modules/reservations/application/historial-de-asistencia';
import { REQUIERE_AREA_KEY } from '../../../src/core/authorization/requiere-area.decorator';
import { PERFILES_SUGERIDOS, definicionDeArea } from '@espartanos/shared';

const AHORA = new Date('2026-10-20T12:00:00Z');
const PICADA = 'empresa-picada';
const OTRA = 'empresa-otra';
const TELEFONO = '+56912345678';
const CORREO = 'ana@correo.cl';

const reserva = (id: string, clientId: string, status: string, startsAt: string, extra: Record<string, unknown> = {}) =>
  ({ id, organizationId: 'org', clientId, formId: `f-${clientId}`, status, startsAt: new Date(startsAt), guestName: 'Ana', guestPhone: TELEFONO, guestEmail: CORREO, ...extra });

/** Un repositorio de reservas en memoria que respeta los parámetros que la consulta le pasa. */
function servicioConReservas(todas: ReturnType<typeof reserva>[]) {
  const servicio = Object.create(ReservationsService.prototype) as ReservationsService & Record<string, unknown>;
  servicio.reservations = {
    findOne: vi.fn(async ({ where }: { where: { id: string } }) => todas.find((fila) => fila.id === where.id) ?? null),
    createQueryBuilder: () => {
      const parametros: Record<string, string> = {};
      const qb = {
        where: (_sql: string, p: Record<string, string>) => { Object.assign(parametros, p); return qb; },
        andWhere: (_sql: string, p: Record<string, string>) => { Object.assign(parametros, p); return qb; },
        orderBy: () => qb,
        take: () => qb,
        getMany: async () => todas.filter((fila) => fila.organizationId === parametros.organizationId && fila.clientId === parametros.clientId && fila.id !== parametros.id
          && (fila.guestPhone === parametros.telefono || fila.guestEmail?.toLowerCase() === parametros.correo)),
      };
      return qb;
    },
  } as never;
  return servicio;
}

function controladorCon(servicio: ReservationsService, nivel: 'oculto' | 'bajo_registro' | 'directo') {
  const controlador = Object.create(ReservationsController.prototype) as Record<string, unknown>;
  controlador.service = servicio;
  controlador.niveles = { nivelesDe: vi.fn(async () => nivelesFijos(nivel)) };
  controlador.accountAccess = { allowedClientIds: vi.fn(async () => [PICADA]) };
  return controlador as unknown as ReservationsController;
}

const peticion = { organizationId: 'org', user: { id: 'u1', role: 'admin' }, query: {} } as never;

describe('historial de asistencia del comensal', () => {
  it('cuenta las que se presentó y las que no, sin contar canceladas ni futuras', () => {
    const resumen = resumirAsistenciaDelComensal([
      reserva('1', PICADA, 'attended', '2026-09-01T20:00:00Z'),
      reserva('2', PICADA, 'no_show', '2026-09-08T20:00:00Z'),
      reserva('3', PICADA, 'no_show', '2026-09-15T20:00:00Z'),
      reserva('4', PICADA, 'cancelled', '2026-09-20T20:00:00Z'),
      reserva('5', PICADA, 'confirmed', '2026-11-01T20:00:00Z'),
    ], AHORA);
    expect(resumen).toMatchObject({ asistio: 1, noAsistio: 2, canceladas: 1, conDesenlace: 4, frase: 'No se presentó 2 de 3 veces.' });
    expect(resumen.proporcionNoShow).toBeCloseTo(2 / 3);
    expect(resumen.ultimas.map((una) => una.id)).toEqual(['4', '3', '2', '1']);
  });

  it('no cruza empresas: el mismo teléfono en otro local no suma', async () => {
    const todas = [
      reserva('actual', PICADA, 'confirmed', '2026-10-25T20:00:00Z'),
      reserva('a', PICADA, 'no_show', '2026-09-01T20:00:00Z'),
      reserva('b', OTRA, 'no_show', '2026-09-02T20:00:00Z'),
      reserva('c', OTRA, 'no_show', '2026-09-03T20:00:00Z'),
      reserva('d', PICADA, 'attended', '2026-09-04T20:00:00Z', { guestPhone: '+56900000000', guestEmail: 'otra@persona.cl' }),
    ];
    const historial = await servicioConReservas(todas).historialDelComensal('org', 'actual', undefined, undefined, AHORA);
    expect(historial.noAsistio).toBe(1);
    expect(historial.conDesenlace).toBe(1);
    expect(historial.ultimas.map((una) => una.id)).toEqual(['a']);
  });

  it.each(['oculto', 'bajo_registro'] as const)('con %s la respuesta no trae el teléfono ni el correo', async (nivel) => {
    const servicio = servicioConReservas([
      reserva('actual', PICADA, 'confirmed', '2026-10-25T20:00:00Z'),
      reserva('a', PICADA, 'no_show', '2026-09-01T20:00:00Z'),
      reserva('b', PICADA, 'attended', '2026-09-02T20:00:00Z'),
    ]);
    const respuesta = await controladorCon(servicio, nivel).historialDelComensal(peticion, 'actual');
    const texto = JSON.stringify(respuesta);
    expect(texto).not.toContain(TELEFONO);
    expect(texto).not.toContain(CORREO);
    expect(respuesta.frase).toBe('No se presentó 1 de 2 veces.');
    expect((respuesta.comensal as Record<string, unknown>).datosProtegidos).toMatchObject({ sePuedePedir: nivel === 'bajo_registro' });
  });

  it('con directo sí lo trae, que es lo que distingue al recorte', async () => {
    const servicio = servicioConReservas([reserva('actual', PICADA, 'confirmed', '2026-10-25T20:00:00Z')]);
    const respuesta = await controladorCon(servicio, 'directo').historialDelComensal(peticion, 'actual');
    expect(JSON.stringify(respuesta)).toContain(TELEFONO);
  });
});

describe('no-show por local y día de la semana', () => {
  const LOCAL = { id: `f-${PICADA}`, nombre: 'Picada', clientId: PICADA, timezone: 'America/Santiago' };

  it('toma el día en la hora del local y calcula la tasa', () => {
    // 20:00 del jueves 1 de octubre en Santiago (UTC-3) ya es viernes en UTC.
    const jueves = (n: number, estado: string) => reserva(`j${n}`, PICADA, estado, '2026-10-02T01:00:00Z');
    const filas = [jueves(1, 'no_show'), jueves(2, 'attended'), jueves(3, 'attended'), jueves(4, 'attended'), jueves(5, 'attended'), reserva('x', PICADA, 'cancelled', '2026-10-02T01:00:00Z')];
    const [local] = noShowPorLocalYDia(filas, [LOCAL]);
    expect(local.porDia[4]).toMatchObject({ nombre: 'jueves', total: 5, noAsistio: 1, tasa: 0.2 });
    expect(local.peorDia?.frase).toBe('Los jueves falla el 20%.');
  });

  it('no declara un peor día con muestra chica', () => {
    const [local] = noShowPorLocalYDia([reserva('1', PICADA, 'no_show', '2026-10-02T01:00:00Z')], [LOCAL]);
    expect(local.peorDia).toBeNull();
  });
});

describe('historial de una reserva', () => {
  it('lo que hizo el sistema no lleva el nombre de una persona', async () => {
    const servicio = Object.create(ReservationsService.prototype) as Record<string, unknown>;
    servicio.reservations = { findOne: vi.fn(async () => reserva('r', PICADA, 'attended', '2026-10-01T20:00:00Z')) };
    const eventos = [
      { id: 'e1', type: 'status_changed', actorType: 'team', actorId: 'u1', createdAt: new Date('2026-10-01T21:14:00Z') },
      { id: 'e2', type: 'status_changed', actorType: 'system', createdAt: new Date('2026-10-01T22:00:00Z') },
    ];
    const find = vi.fn(async () => eventos);
    servicio.events = { find };
    servicio.dataSource = { query: vi.fn(async () => [{ id: 'u1', name: 'Pablo' }]) };
    const resultado = await (servicio as unknown as ReservationsService).history('org', 'r');
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ order: { createdAt: 'DESC' } }));
    expect(resultado.find((e) => e.actorType === 'system')?.actorName).toBeNull();
    expect(resultado.find((e) => e.actorType === 'team')?.actorName).toBe('Pablo');
  });
});

describe('el área reservations.historial', () => {
  it('está definida, las rutas nuevas la exigen en ver y el garzón no la tiene', () => {
    expect(definicionDeArea('reservations.historial')).toBeDefined();
    for (const metodo of ['historialDelComensal', 'noShow']) {
      const proto = ReservationsController.prototype as unknown as Record<string, object>;
      expect(Reflect.getMetadata(REQUIERE_AREA_KEY, proto[metodo])).toMatchObject({ clave: 'reservations.historial', nivel: 'ver' });
    }
    const tiene = (nombre: string) => PERFILES_SUGERIDOS.find((perfil) => perfil.nombre === nombre)?.areas['reservations.historial'];
    expect(tiene('Anfitrión')).toBe('ver');
    expect(tiene('Jefe de local')).toBe('ver');
    expect(tiene('Garzón')).toBeUndefined();
  });
});
