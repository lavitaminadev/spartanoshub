import { describe, expect, it, vi } from 'vitest';
import { NivelDeAreaService } from '../../../src/core/client-scope/nivel-de-area.service';

/**
 * Hasta dónde llega una persona en un área.
 *
 * Es la reja más fina y la última en llegar: el módulo decide si entra a Reservas, el área decide
 * si además puede configurar el local. Estas pruebas defienden las tres cosas que la harían
 * inútil: que sin perfil no bloquee a nadie, que `hacer` incluya `ver`, y que una excepción
 * pueda **quitar** y no sólo conceder.
 */
function montar(opciones: {
  perfil?: Record<string, string>;
  extras?: Array<{ action: string; allowed: boolean; clientId?: string | null; expiresAt?: Date | null }>;
  sinAsignacion?: boolean;
}) {
  const asignaciones = {
    findOne: vi.fn().mockResolvedValue(opciones.sinAsignacion ? null : { perfilId: 'p1' }),
  };
  const perfiles = {
    findOne: vi.fn().mockResolvedValue(opciones.perfil ? { id: 'p1', areas: opciones.perfil } : null),
  };
  const extras = { find: vi.fn().mockResolvedValue(opciones.extras ?? []) };
  return new NivelDeAreaService(asignaciones as never, perfiles as never, extras as never);
}

const ORG = 'org-1';
const USUARIO = 'u1';
const EMPRESA = 'empresa-a';

describe('nivel de área', () => {
  it('el perfil concede cuando incluye el área', async () => {
    const servicio = montar({ perfil: { 'reservations.turno': 'hacer' } });
    await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.turno', 'hacer')).resolves.toBe(true);
  });

  it('y niega cuando no la incluye: lo que no se concedió, no se tiene', async () => {
    const servicio = montar({ perfil: { 'reservations.turno': 'hacer' } });
    await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.configurar', 'hacer')).resolves.toBe(false);
  });

  /* Quien edita, mira. Al revés no. */
  it('«hacer» incluye «ver», y «ver» no alcanza para «hacer»', async () => {
    const soloVer = montar({ perfil: { 'reservations.reservas': 'ver' } });
    const puedeHacer = montar({ perfil: { 'reservations.reservas': 'hacer' } });

    await expect(soloVer.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.reservas', 'ver')).resolves.toBe(true);
    await expect(soloVer.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.reservas', 'hacer')).resolves.toBe(false);
    await expect(puedeHacer.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.reservas', 'ver')).resolves.toBe(true);
  });

  /*
   * Sin perfil no se bloquea nada: manda el permiso de módulo, como antes de que los perfiles
   * existieran. Es lo que permite repartirlos poco a poco sin dejar a nadie sin trabajar.
   */
  it('sin perfil asignado no bloquea', async () => {
    const servicio = montar({ sinAsignacion: true });
    await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.configurar', 'hacer')).resolves.toBe(true);
  });

  it('sin empresa tampoco: la reja del área es por empresa', async () => {
    const servicio = montar({ perfil: {} });
    await expect(servicio.alcanzaArea(ORG, USUARIO, undefined, 'reservations.configurar', 'hacer')).resolves.toBe(true);
  });

  /*
   * Que la excepción pueda quitar es lo que evita inventar un perfil nuevo cada vez que alguien
   * concreto necesita una cosa menos.
   */
  it('una excepción concede lo que el perfil no da', async () => {
    const servicio = montar({
      perfil: {},
      extras: [{ action: 'reservations.cupones', allowed: true }],
    });
    await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.cupones', 'hacer')).resolves.toBe(true);
  });

  it('y una excepción quita lo que el perfil sí daba', async () => {
    const servicio = montar({
      perfil: { 'reservations.exportar': 'hacer' },
      extras: [{ action: 'reservations.exportar', allowed: false }],
    });
    await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.exportar', 'hacer')).resolves.toBe(false);
  });

  it('una excepción vencida no cuenta', async () => {
    const servicio = montar({
      perfil: {},
      extras: [{ action: 'reservations.cupones', allowed: true, expiresAt: new Date(Date.now() - 1000) }],
    });
    await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.cupones', 'hacer')).resolves.toBe(false);
  });

  it('una excepción de otra empresa no alcanza a ésta', async () => {
    const servicio = montar({
      perfil: {},
      extras: [{ action: 'reservations.cupones', allowed: true, clientId: 'empresa-b' }],
    });
    await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.cupones', 'hacer')).resolves.toBe(false);
  });

  /*
   * Una clave fuera del catálogo es una ruta mal escrita. Dejarla pasar la escondería hasta que
   * alguien reclamara que no puede trabajar.
   */
  it('un área que no existe en el catálogo falla en voz alta', async () => {
    const servicio = montar({ perfil: {} });
    await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, 'reservations.inventada', 'hacer')).rejects.toThrow(/inventada/);
  });
});

/**
 * Descartar un prospecto no tiene ruta propia: viaja como un estado dentro de editarlo, así que
 * el decorador —que mira la ruta y no el cuerpo— no alcanza y se comprueba en el controlador.
 * Estas dos fijan que el área exista y se comporte como las demás.
 */
describe('descartar, el área sin ruta propia', () => {
  it('un perfil que no la incluye no descarta', async () => {
    const servicio = montar({ perfil: { 'crm.prospectos': 'hacer' } });
    await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, 'crm.descartar', 'hacer')).resolves.toBe(false);
  });

  it('y uno que sí la incluye, descarta aunque sólo vea los prospectos', async () => {
    const servicio = montar({ perfil: { 'crm.prospectos': 'ver', 'crm.descartar': 'hacer' } });
    await expect(servicio.alcanzaArea(ORG, USUARIO, EMPRESA, 'crm.descartar', 'hacer')).resolves.toBe(true);
  });
});
