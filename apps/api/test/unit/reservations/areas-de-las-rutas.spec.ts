import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { REQUIERE_AREA_KEY, type AreaExigida } from '../../../src/core/authorization/requiere-area.decorator';
import { NivelDeAreaService } from '../../../src/core/client-scope/nivel-de-area.service';
import { PublicReservationsController } from '../../../src/modules/reservations/public-reservations.controller';
import { ReservationsController } from '../../../src/modules/reservations/reservations.controller';
import { AREAS } from '@espartanos/shared';

/**
 * El reparto de Reservas entre perfiles.
 *
 * Fija lo que más importa de declarar áreas en las rutas: que quien atiende la sala llegue a lo
 * del turno y no a configurar el local, que exportar sea un permiso aparte, y que el flujo
 * público de reserva —sin sesión, sin perfil que comprobar— no lleve ninguna.
 */
function areaDe(controlador: object, metodo: string): AreaExigida | undefined {
  const proto = (controlador as { prototype: Record<string, unknown> }).prototype;
  return Reflect.getMetadata(REQUIERE_AREA_KEY, proto[metodo] as object);
}

function servicioConPerfil(areas: Record<string, string>) {
  const asignaciones = { findOne: vi.fn().mockResolvedValue({ perfilId: 'p1' }) };
  const perfiles = { findOne: vi.fn().mockResolvedValue({ id: 'p1', areas }) };
  const extras = { find: vi.fn().mockResolvedValue([]) };
  return new NivelDeAreaService(asignaciones as never, perfiles as never, extras as never);
}

const GARZON = { 'reservations.turno': 'hacer', 'reservations.reservas': 'ver', 'reservations.canjear_cupon': 'hacer' };

async function alcanza(perfil: Record<string, string>, exigida: AreaExigida | undefined) {
  expect(exigida).toBeDefined();
  return servicioConPerfil(perfil).alcanzaArea('org', 'u1', 'empresa', exigida!.clave, exigida!.nivel);
}

describe('áreas declaradas en las rutas de Reservas', () => {
  it('un perfil de garzón alcanza el turno y no la configuración del local', async () => {
    await expect(alcanza(GARZON, areaDe(ReservationsController, 'registrarSalida'))).resolves.toBe(true);
    await expect(alcanza(GARZON, areaDe(ReservationsController, 'closeDay'))).resolves.toBe(false);
    await expect(alcanza(GARZON, areaDe(ReservationsController, 'actualizarOperacion'))).resolves.toBe(false);
    await expect(alcanza(GARZON, areaDe(ReservationsController, 'deleteBlock'))).resolves.toBe(false);
  });

  it('exportar queda fuera de un perfil que no lo incluye, en las tres salidas', async () => {
    for (const metodo of ['exportCsv', 'exportForm', 'canjesCsv']) {
      await expect(alcanza(GARZON, areaDe(ReservationsController, metodo))).resolves.toBe(false);
      await expect(alcanza({ 'reservations.exportar': 'hacer' }, areaDe(ReservationsController, metodo))).resolves.toBe(true);
    }
  });

  it('ver una reserva no alcanza para editarla ni cancelarla', async () => {
    await expect(alcanza(GARZON, areaDe(ReservationsController, 'getReservation'))).resolves.toBe(true);
    await expect(alcanza(GARZON, areaDe(ReservationsController, 'updateReservation'))).resolves.toBe(false);
  });

  it('canjear un cupón no es crearlo: el canje se hace en la caja, la oferta se define aparte', async () => {
    await expect(alcanza(GARZON, areaDe(ReservationsController, 'canjearCuponEnLocal'))).resolves.toBe(true);
    await expect(alcanza(GARZON, areaDe(ReservationsController, 'createCoupon'))).resolves.toBe(false);
  });

  it('las rutas públicas no declaran ningún área', () => {
    const proto = PublicReservationsController.prototype as unknown as Record<string, unknown>;
    const metodos = Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor' && typeof proto[n] === 'function');
    expect(metodos.length).toBeGreaterThan(0);
    for (const metodo of metodos) expect(areaDe(PublicReservationsController, metodo), metodo).toBeUndefined();
  });

  it('toda área declarada existe en el catálogo, con un nivel que ese área admite', () => {
    const proto = ReservationsController.prototype as unknown as Record<string, unknown>;
    for (const metodo of Object.getOwnPropertyNames(proto)) {
      const exigida = areaDe(ReservationsController, metodo);
      if (!exigida) continue;
      const definicion = AREAS.find((a) => a.clave === exigida.clave);
      expect(definicion, `${metodo}: ${exigida.clave}`).toBeDefined();
      expect(definicion!.niveles, `${metodo}: ${exigida.clave}`).toContain(exigida.nivel);
    }
  });
});
