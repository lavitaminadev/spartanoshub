/**
 * El cupón que anuncia una campaña tiene que servir cuando llegue a la caja.
 *
 * La comprobación existe para evitar «un código que la caja rechaza delante del cliente», pero
 * miraba tres de las cuatro condiciones: existía, era de la empresa, estaba activo y no había
 * vencido. **No miraba si le quedaban usos**, y un cupón con tope se agota sin cambiar de estado
 * ni de fecha, así que pasaba y salía anunciado a la lista entera.
 *
 * Lo segundo que se defiende acá es el momento: entre escribir la campaña y mandarla pueden
 * pasar semanas, y comprobar sólo al guardar dejaba salir doscientos correos con un código que
 * murió en el intervalo.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { CampanasService } from '../../../src/modules/marketing/campanas.service';

const VIGENTE = { id: 'cup-1', code: 'VUELVE20', clientId: 'c-casa', active: true, validUntil: new Date('2030-01-01'), maxUses: 0, usageCount: 0 };

function montar(cupon: Record<string, unknown> | null, campana: Record<string, unknown> = {}) {
  const fila = {
    id: 'camp-1', organizationId: 'org-1', clientId: 'c-casa', asunto: 'Vuelve', cuerpo: 'Hola',
    cupon: 'VUELVE20', estado: 'draft', destino: 'lista', enviados: 0, destinatarios: 0, sentAt: null,
    ...campana,
  };
  const repo = {
    findOne: vi.fn(async () => fila),
    update: vi.fn(async () => ({ affected: 1 })),
    save: vi.fn(async (f: unknown) => f),
    create: vi.fn((f: unknown) => f),
    find: vi.fn(async () => [fila]),
  };
  const suscriptores = { suscritos: vi.fn(async () => [{ id: 's-1', email: 'ana@correo.cl', name: 'Ana', unsubscribeToken: 't-1', clientId: 'c-casa', organizationId: 'org-1' }]) };
  const envios = { encolar: vi.fn(async (_c: unknown, d: unknown[]) => d.length), avanceDe: vi.fn(async () => ({ enviados: 0, pendientes: 0, fallidos: 0 })) };
  const parametros = { get: vi.fn(async () => true) };
  const cupones = { findOne: vi.fn(async () => cupon) };
  const usuarios = { find: vi.fn(async () => []) };
  const canjes = { find: vi.fn(async () => []) };
  const srv = new CampanasService(
    repo as never, suscriptores as never, envios as never, parametros as never,
    cupones as never, usuarios as never, canjes as never,
  );
  return { srv, repo, envios, canjes };
}

describe('el cupón de una campaña', () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.APP_PUBLIC_URL = 'https://cuartel.espartanos.cl'; });

  it('no deja guardar una campaña con un cupón que ya agotó sus usos', async () => {
    const { srv } = montar({ ...VIGENTE, maxUses: 50, usageCount: 50 });

    await expect(srv.crear({ organizationId: 'org-1', clientId: 'c-casa', asunto: 'Vuelve', cuerpo: 'Hola', cupon: 'VUELVE20' } as never))
      .rejects.toThrow(BadRequestException);
    await expect(srv.crear({ organizationId: 'org-1', clientId: 'c-casa', asunto: 'Vuelve', cuerpo: 'Hola', cupon: 'VUELVE20' } as never))
      .rejects.toThrow(/ya agotó sus usos/);
  });

  it('un cupón sin tope no se considera agotado por muchos usos que lleve', async () => {
    // `maxUses = 0` es sin tope: contar usos ahí habría roto el caso normal.
    const { srv } = montar({ ...VIGENTE, maxUses: 0, usageCount: 999 });

    await expect(srv.crear({ organizationId: 'org-1', clientId: 'c-casa', asunto: 'Vuelve', cuerpo: 'Hola', cupon: 'VUELVE20' } as never))
      .resolves.toBeTruthy();
  });

  it('al enviar se vuelve a comprobar: un cupón que murió después de escribirla detiene el envío', async () => {
    // Se guardó con el cupón vivo; para cuando se aprieta enviar, alguien lo desactivó.
    const { srv, envios } = montar({ ...VIGENTE, active: false });

    await expect(srv.enviar('camp-1', 'org-1')).rejects.toThrow(/está desactivado/);
    // Y no se encoló a nadie: el correo entero está escrito alrededor de esa oferta.
    expect(envios.encolar).not.toHaveBeenCalled();
  });

  it('con el cupón sano, el envío encola normalmente', async () => {
    const { srv, envios } = montar(VIGENTE);

    await expect(srv.enviar('camp-1', 'org-1')).resolves.toMatchObject({ enCola: true });
    expect(envios.encolar).toHaveBeenCalled();
  });
});

describe('qué trajo la campaña', () => {
  beforeEach(() => vi.clearAllMocks());

  it('cuenta los canjes del cupón sólo desde que la campaña salió', async () => {
    const salida = new Date('2026-10-10T12:00:00Z');
    const { srv, canjes } = montar(VIGENTE, { estado: 'sent', sentAt: salida, enviados: 184 });
    canjes.find.mockResolvedValue([
      { canal: 'reserva', monto: '31500', descuento: '6300', createdAt: new Date('2026-10-12T20:00:00Z') },
      { canal: 'local', monto: null, descuento: null, createdAt: new Date('2026-10-11T20:00:00Z') },
    ]);

    const retorno = await srv.retorno('camp-1', 'org-1');

    expect(retorno).toMatchObject({ cupon: 'VUELVE20', enviados: 184, canjes: 2, porReserva: 1, enElLocal: 1, consumo: 31500 });
    // El recorte por fecha lo hace la consulta: lo anterior al envío no lo trajo la campaña.
    expect(canjes.find).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ couponId: 'cup-1' }),
    }));
  });

  it('una campaña sin enviar todavía no tiene nada que contar', async () => {
    // Distinto de contar cero: cero se leería como «no funcionó».
    const { srv } = montar(VIGENTE, { estado: 'draft', sentAt: null });

    expect(await srv.retorno('camp-1', 'org-1')).toBeUndefined();
  });
});
