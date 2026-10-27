import { describe, expect, it, vi } from 'vitest';
import { SuscriptoresService } from '../../../src/modules/marketing/suscriptores.service';

/*
 * Volver a dar el permiso levanta la exclusión, pero no borra la prueba de que alguien pidió la baja.
 */
function servicio(exclusiones: Array<Record<string, any>>) {
  const lista = {
    find: vi.fn(async ({ where }: { where: Record<string, any> }) => exclusiones.filter((f) => where.activa === undefined || f.activa === where.activa)),
    findOne: vi.fn(async ({ where }: { where: Record<string, any> }) => exclusiones.find((f) => f.huella === where.huella) ?? null),
    save: vi.fn(async (v: any) => v),
    remove: vi.fn(),
    create: vi.fn((v: any) => v),
  };
  return { srv: new SuscriptoresService({} as never, lista as never), lista };
}

const fila = (extra: Record<string, unknown> = {}) => ({ organizationId: 'org-1', clientId: 'c-casa', alcance: 'local', huella: 'h', activa: true, vecesLevantada: 0, ...extra });

describe('levantar una exclusión', () => {
  it('la marca como levantada con fecha y origen, y no borra la fila', async () => {
    const exclusiones = [fila()];
    const { srv, lista } = servicio(exclusiones);

    await srv.levantarExclusion('org-1', 'ana@casa.cl', 'c-casa', 'reserva con casilla marcada');

    expect(lista.remove).not.toHaveBeenCalled();
    expect(exclusiones).toHaveLength(1);
    expect(exclusiones[0]).toMatchObject({ activa: false, levantadaOrigen: 'reserva con casilla marcada', vecesLevantada: 1 });
    expect(exclusiones[0].levantadaEl).toBeInstanceOf(Date);
  });

  it('levantada, ya no prohíbe escribir', async () => {
    const { srv } = servicio([fila({ activa: false })]);
    await expect(srv.exclusionDe('org-1', 'ana@casa.cl', 'c-casa')).resolves.toBeNull();
  });

  it('una nueva petición reactiva la misma fila y conserva cuándo se levantó', async () => {
    const levantada = new Date('2026-05-01T00:00:00Z');
    const exclusiones = [fila({ activa: false, levantadaEl: levantada, vecesLevantada: 1 })];
    const { srv, lista } = servicio(exclusiones);

    await (srv as any).anotarExclusion('org-1', 'h', 'c-casa', 'local', 'email.birthday');

    expect(lista.save).toHaveBeenCalledTimes(1);
    expect(exclusiones[0]).toMatchObject({ activa: true, levantadaEl: levantada, vecesLevantada: 1, origen: 'email.birthday' });
  });
});
