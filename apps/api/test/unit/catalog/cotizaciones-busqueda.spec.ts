import { describe, expect, it, vi } from 'vitest';
import { QuotesService } from '../../../src/modules/catalog/quotes.service';
import { QuoteStatus } from '../../../src/modules/catalog/quote-status.enum';
import { arbolDeVersiones, patronDeBusqueda, resumenDeCotizaciones, type CotizacionDelHistorial } from '../../../src/modules/catalog/cotizaciones-historial';

const dia = (d: number) => new Date(Date.UTC(2026, 2, d));
const cot = (id: string, version: number, extra: Partial<CotizacionDelHistorial> = {}): CotizacionDelHistorial => ({
  id, number: `COT-${id}`, version, status: QuoteStatus.DRAFT, createdAt: dia(version), amount: '1000', currency: 'CLP', ...extra,
});

function servicioConQb() {
  const qb: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ['leftJoinAndSelect', 'where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = vi.fn().mockReturnValue(qb);
  qb.getManyAndCount = vi.fn().mockResolvedValue([[], 0]);
  const quotes = { createQueryBuilder: vi.fn().mockReturnValue(qb), find: vi.fn(), findOne: vi.fn() };
  const leads = { findOne: vi.fn() };
  const servicio = new QuotesService(quotes as never, {} as never, leads as never, {} as never, {} as never, {} as never);
  return { servicio, qb, quotes, leads };
}

describe('listado de cotizaciones: filtros', () => {
  it('busca la empresa por fragmento con colación insensible a acentos y mayúsculas', async () => {
    const { servicio, qb } = servicioConQb();
    await servicio.list('org', { empresa: ' vitamina ' });
    const [sql, params] = qb.andWhere.mock.calls[0];
    expect(sql).toContain('lead.company COLLATE utf8mb4_unicode_ci LIKE :patron');
    expect(params).toEqual({ patron: '%vitamina%' });
  });

  it('trata los comodines como texto y no arma patrón con ellos', () => {
    expect(patronDeBusqueda('50%_off')).toBe('%50 off%');
    expect(patronDeBusqueda('   ')).toBeUndefined();
    expect(patronDeBusqueda(undefined)).toBeUndefined();
    expect(patronDeBusqueda('Café')).toBe('%Café%');
  });

  it('sin empresa no agrega la condición de texto', async () => {
    const { servicio, qb } = servicioConQb();
    await servicio.list('org', {});
    expect(qb.andWhere).not.toHaveBeenCalled();
  });

  it('acota por estado y por fechas, con el día final completo', async () => {
    const { servicio, qb } = servicioConQb();
    await servicio.list('org', { status: QuoteStatus.SENT, desde: '2026-03-01', hasta: '2026-03-31' });
    expect(qb.andWhere.mock.calls.map((c) => c[0])).toEqual(['q.status = :status', 'q.createdAt >= :desde', 'q.createdAt <= :hasta']);
    expect(qb.andWhere.mock.calls[2][1].hasta.getHours()).toBe(23);
  });

  it('pagina: 50 por defecto y respeta limit y offset', async () => {
    const { servicio, qb } = servicioConQb();
    await expect(servicio.list('org', {})).resolves.toMatchObject({ limit: 50, offset: 0, total: 0 });
    await servicio.list('org', { limit: 10, offset: 20 });
    expect(qb.take).toHaveBeenLastCalledWith(10);
    expect(qb.skip).toHaveBeenLastCalledWith(20);
  });
});

describe('árbol de versiones', () => {
  it('sale en orden de versión aunque lleguen desordenadas', () => {
    const arbol = arbolDeVersiones([cot('c', 3), cot('a', 1), cot('b', 2)], 'b');
    expect(arbol.map((v) => v.version)).toEqual([1, 2, 3]);
    expect(arbol.find((v) => v.actual)?.id).toBe('b');
  });

  it('una cadena de una sola versión no se rompe', () => {
    expect(arbolDeVersiones([cot('a', 1)])).toHaveLength(1);
    expect(arbolDeVersiones([])).toEqual([]);
  });

  it('el servicio parte de la raíz aunque se consulte una versión hija', async () => {
    const { servicio, quotes } = servicioConQb();
    const hija = cot('h', 2, { parentQuoteId: 'r' });
    quotes.findOne.mockResolvedValue(hija);
    quotes.find.mockResolvedValue([hija, cot('r', 1)]);
    const arbol = await servicio.versiones('h', 'org');
    expect(quotes.find.mock.calls[0][0].where).toEqual([{ id: 'r', organizationId: 'org' }, { parentQuoteId: 'r', organizationId: 'org' }]);
    expect(arbol.map((v) => v.id)).toEqual(['r', 'h']);
  });
});

describe('resumen de cotizaciones del lead', () => {
  it('sin cotizaciones no hay resumen: cero veces y sin fecha', () => {
    expect(resumenDeCotizaciones([])).toEqual({ veces: 0, ultimaEn: null });
  });

  it('un borrador sin enviar no cuenta como haber cotizado', () => {
    expect(resumenDeCotizaciones([cot('a', 1)]).veces).toBe(0);
  });

  it('cuenta cotizaciones y no versiones, y devuelve la última fecha de envío', () => {
    const r = resumenDeCotizaciones([
      cot('a', 1, { sentAt: dia(3) }), cot('b', 2, { parentQuoteId: 'a', sentAt: dia(14) }), cot('z', 1, { sentAt: dia(20) }),
    ]);
    expect(r.veces).toBe(2);
    expect(r.ultimaEn).toEqual(dia(20));
  });

  it('un lead de audiencia no tiene resumen aunque tenga filas', async () => {
    const { servicio, leads, quotes } = servicioConQb();
    leads.findOne.mockResolvedValue({ id: 'l', domain: 'audience' });
    await expect(servicio.resumenDelLead('l', 'org')).resolves.toEqual({ veces: 0, ultimaEn: null });
    expect(quotes.find).not.toHaveBeenCalled();
  });
});
