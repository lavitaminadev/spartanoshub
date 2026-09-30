import { NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SuscriptoresService } from '../../../src/modules/marketing/suscriptores.service';
import { EstadoDeSuscripcion } from '../../../src/modules/marketing/suscriptor.entity';

/*
 * Darse de baja del correo comercial.
 *
 * El articulo 28 B de la Ley 19.496 dice que, pedida la suspension, los envios siguientes
 * «quedaran desde entonces prohibidos»: por eso es inmediata. Y va por empresa, porque cada una es
 * responsable distinto de esos datos y el permiso se le dio a cada una por separado: antes habia
 * una sola ficha por organizacion y darse de baja desde el correo de un local sacaba de todos.
 */
function servicio(fichas: Array<Record<string, unknown>>, exclusiones: Array<Record<string, unknown>> = []) {
  const repo = {
    findOne: vi.fn(async ({ where }: { where: Record<string, unknown> }) => fichas.find((f) => f.unsubscribeToken === where.unsubscribeToken) ?? null),
    find: vi.fn(async ({ where }: { where: Record<string, unknown> }) => fichas.filter((f) => f.organizationId === where.organizationId && f.email === where.email)),
    save: vi.fn(async (v: unknown) => v),
  };
  const listaExclusion = {
    findOne: vi.fn(async () => null),
    find: vi.fn(async () => exclusiones),
    create: vi.fn((v: unknown) => v),
    save: vi.fn(async (v: Record<string, unknown>) => { exclusiones.push(v); return v; }),
    remove: vi.fn(async () => undefined),
  };
  return { srv: new SuscriptoresService(repo as never, listaExclusion as never), repo, listaExclusion, exclusiones };
}

const ficha = (extra: Record<string, unknown>) => ({
  organizationId: 'org-1', email: 'ana@casa.cl', status: EstadoDeSuscripcion.SUSCRITO, ...extra,
});

describe('baja del correo comercial', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saca sólo del local del correo, y deja los demás intactos', async () => {
    const casa = ficha({ clientId: 'c-casa', unsubscribeToken: 't-casa' });
    const bar = ficha({ clientId: 'c-bar', unsubscribeToken: 't-bar' });
    const { srv } = servicio([casa, bar]);

    const resultado = await srv.darDeBaja('t-casa', 'local', 'email.birthday');

    expect(resultado).toEqual({ email: 'ana@casa.cl', alcance: 'local', empresa: 'c-casa' });
    expect(casa.status).toBe(EstadoDeSuscripcion.BAJA);
    expect(bar.status).toBe(EstadoDeSuscripcion.SUSCRITO);
  });

  it('deja constancia de qué se pidió y desde qué correo', async () => {
    const casa = ficha({ clientId: 'c-casa', unsubscribeToken: 't-casa' });
    const { srv, exclusiones } = servicio([casa]);

    await srv.darDeBaja('t-casa', 'local', 'email.coupon_post_visit');

    expect(casa.unsubscribedScope).toBe('local');
    expect(casa.unsubscribedFrom).toBe('email.coupon_post_visit');
    expect(casa.unsubscribedAt).toBeInstanceOf(Date);
    expect(exclusiones[0]).toMatchObject({ clientId: 'c-casa', alcance: 'local' });
  });

  it('«de todas» saca de todos los locales y de la agencia', async () => {
    const casa = ficha({ clientId: 'c-casa', unsubscribeToken: 't-casa' });
    const bar = ficha({ clientId: 'c-bar', unsubscribeToken: 't-bar' });
    const agencia = ficha({ clientId: null, unsubscribeToken: 't-ag' });
    const { srv, exclusiones } = servicio([casa, bar, agencia]);

    const resultado = await srv.darDeBaja('t-casa', 'todas');

    expect(resultado.alcance).toBe('todas');
    for (const fila of [casa, bar, agencia]) expect(fila.status).toBe(EstadoDeSuscripcion.BAJA);
    // Sin empresa en la exclusión: es la que se respeta aunque después reserve en un local nuevo.
    expect(exclusiones[0]).toMatchObject({ clientId: null, alcance: 'todas' });
  });

  it('no guarda el correo en la lista de exclusión, sólo su huella', async () => {
    const { srv, exclusiones } = servicio([ficha({ clientId: 'c-casa', unsubscribeToken: 't-casa' })]);

    await srv.darDeBaja('t-casa', 'todas');

    const anotado = JSON.stringify(exclusiones[0]);
    expect(anotado).not.toContain('ana@casa.cl');
    expect((exclusiones[0] as { huella: string }).huella).toHaveLength(64);
  });

  it('la huella cambia entre organizaciones: no se puede comprobar un correo probándolo', async () => {
    const a = servicio([ficha({ organizationId: 'org-1', clientId: null, unsubscribeToken: 't1' })]);
    const b = servicio([ficha({ organizationId: 'org-2', clientId: null, unsubscribeToken: 't2' })]);

    await a.srv.darDeBaja('t1', 'todas');
    await b.srv.darDeBaja('t2', 'todas');

    expect((a.exclusiones[0] as { huella: string }).huella).not.toBe((b.exclusiones[0] as { huella: string }).huella);
  });

  it('repetir el enlace no falla ni cambia la fecha original', async () => {
    const casa = ficha({ clientId: 'c-casa', unsubscribeToken: 't-casa' });
    const { srv } = servicio([casa]);

    await srv.darDeBaja('t-casa', 'local');
    const primera = casa.unsubscribedAt;
    await srv.darDeBaja('t-casa', 'local');

    expect(casa.unsubscribedAt).toBe(primera);
  });

  it('un enlace inventado no da de baja a nadie', async () => {
    const { srv, repo } = servicio([ficha({ clientId: 'c-casa', unsubscribeToken: 't-casa' })]);
    await expect(srv.darDeBaja('inventado')).rejects.toThrow(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });
});

describe('a quién se le puede volver a escribir', () => {
  it('«de todas» pesa más que la empresa: no se le escribe desde ninguna', async () => {
    const { srv } = servicio([], [{ clientId: null, alcance: 'todas', huella: 'x' }]);
    await expect(srv.exclusionDe('org-1', 'ana@casa.cl', 'c-bar')).resolves.toBe('todas');
  });

  it('la baja de un local no alcanza a otro', async () => {
    const exclusiones = [{ clientId: 'c-casa', alcance: 'local' }];
    const { srv } = servicio([], exclusiones);
    // La lista devuelve lo mismo para cualquier consulta, así que se distingue por la empresa.
    await expect(srv.exclusionDe('org-1', 'ana@casa.cl', 'c-casa')).resolves.toBe('local');
    await expect(srv.exclusionDe('org-1', 'ana@casa.cl', 'c-bar')).resolves.toBeNull();
  });

  it('sin nada anotado, se le puede escribir', async () => {
    const { srv } = servicio([], []);
    await expect(srv.exclusionDe('org-1', 'ana@casa.cl', 'c-casa')).resolves.toBeNull();
  });
});
