import { describe, expect, it } from 'vitest';
import { BOARD_COLUMNS, DESIGN_COLUMNS, groupByColumn, isStalled, statusesFor, uncoveredStatuses } from './board-columns';
import { applyBoardFilters, hasActiveFilters } from './board-filters';

const HORA = 3_600_000;
const AHORA = new Date('2026-08-15T12:00:00Z').getTime();

const pieza = (over: Record<string, unknown> = {}) => ({
  id: 'p1', status: 'backlog', title: 'Post de agosto',
  clientId: 'c1', type: 'post_simple', assignedTo: 'u1',
  updatedAt: new Date(AHORA - HORA).toISOString(),
  ...over,
});

describe('columnas del tablero', () => {
  it('las columnas cubren el flujo completo, sin etapas que hagan desaparecer trabajo', () => {
    // Si esta prueba falla es porque alguien agregó una etapa al flujo y no la puso en ninguna
    // columna: las piezas en esa etapa dejarían de verse sin que nadie lo note.
    expect(uncoveredStatuses('design')).toEqual([]);
    expect(uncoveredStatuses('audiovisual')).toEqual([]);
  });

  it('cada etapa cae en una sola columna', () => {
    const vistas = statusesFor('design');
    expect(new Set(vistas).size).toBe(vistas.length);
  });

  it('agrupa el trabajo en su columna', () => {
    const grupos = groupByColumn([
      pieza({ id: '1', status: 'backlog' }),
      pieza({ id: '2', status: 'in_progress' }),
      pieza({ id: '3', status: 'assigned' }),
      pieza({ id: '4', status: 'correction' }),
      pieza({ id: '5', status: 'delivered' }),
    ], DESIGN_COLUMNS);

    expect(grupos.to_assign.map((p) => p.id)).toEqual(['1']);
    expect(grupos.working.map((p) => p.id)).toEqual(['2', '3']);
    expect(grupos.with_client.map((p) => p.id)).toEqual(['4']);
    expect(grupos.done.map((p) => p.id)).toEqual(['5']);
  });

  it('lo cancelado no aparece como trabajo por asignar', () => {
    const grupos = groupByColumn([pieza({ id: '9', status: 'cancelled' })], DESIGN_COLUMNS);
    expect(Object.values(grupos).flat()).toHaveLength(0);
  });

  it('las dos áreas tienen columnas declaradas', () => {
    expect(BOARD_COLUMNS.design.length).toBeGreaterThan(0);
    expect(BOARD_COLUMNS.audiovisual.length).toBeGreaterThan(0);
  });
});

describe('trabajo detenido', () => {
  it('marca lo que no se mueve hace más del umbral', () => {
    const viejo = pieza({ updatedAt: new Date(AHORA - 60 * HORA).toISOString() });
    expect(isStalled(viejo, 48, AHORA)).toBe(true);
    expect(isStalled(pieza(), 48, AHORA)).toBe(false);
  });

  it('lo cerrado nunca está detenido', () => {
    const entregado = pieza({ status: 'delivered', updatedAt: new Date(AHORA - 500 * HORA).toISOString() });
    expect(isStalled(entregado, 48, AHORA)).toBe(false);
  });

  it('sin fecha de movimiento no inventa que está detenido', () => {
    expect(isStalled(pieza({ updatedAt: undefined }), 48, AHORA)).toBe(false);
  });
});

describe('filtros del tablero', () => {
  const contexto = { staleHours: 48, now: AHORA };
  const universo = [
    pieza({ id: '1', status: 'backlog', clientId: 'c1', type: 'post_simple', assignedTo: 'roy' }),
    pieza({ id: '2', status: 'internal_review', clientId: 'c2', type: 'carousel', assignedTo: 'piri' }),
    pieza({ id: '3', status: 'client_validation', clientId: 'c1', type: 'logo', assignedTo: 'roy' }),
    pieza({ id: '4', status: 'delivered', clientId: 'c1', type: 'post_simple', assignedTo: 'roy' }),
    pieza({ id: '5', status: 'in_progress', clientId: 'c2', type: 'logo', assignedTo: 'piri', updatedAt: new Date(AHORA - 90 * HORA).toISOString() }),
  ];

  const ids = (filtros: Parameters<typeof applyBoardFilters>[1]) =>
    applyBoardFilters(universo, filtros, contexto).map((p) => p.id);

  it('filtra por cliente, que es la vista de una community manager', () => {
    expect(ids({ clientId: 'c1' })).toEqual(['1', '3', '4']);
  });

  it('filtra por tipo de pieza', () => {
    expect(ids({ type: 'logo' })).toEqual(['3', '5']);
  });

  it('filtra por responsable, que es el «solo lo mío»', () => {
    expect(ids({ assignedTo: 'piri' })).toEqual(['2', '5']);
  });

  it('responde las vistas rápidas', () => {
    expect(ids({ view: 'pending' })).toEqual(['1', '5']);
    expect(ids({ view: 'to_review' })).toEqual(['2']);
    expect(ids({ view: 'to_finish' })).toEqual(['3']);
    expect(ids({ view: 'finished' })).toEqual(['4']);
  });

  it('encuentra lo estancado, que es lo único que no se ve en las columnas', () => {
    expect(ids({ view: 'stalled' })).toEqual(['5']);
  });

  it('combina filtros en vez de quedarse con el último', () => {
    expect(ids({ clientId: 'c1', assignedTo: 'roy', view: 'finished' })).toEqual(['4']);
  });

  it('«todo» no descarta nada', () => {
    expect(ids({ view: 'all' })).toHaveLength(5);
    expect(ids({})).toHaveLength(5);
  });

  it('busca por título sin distinguir mayúsculas', () => {
    expect(ids({ search: 'AGOSTO' })).toHaveLength(5);
    expect(ids({ search: 'inexistente' })).toHaveLength(0);
  });

  it('sabe si hay filtros puestos, para ofrecer limpiarlos', () => {
    expect(hasActiveFilters({})).toBe(false);
    expect(hasActiveFilters({ view: 'all' })).toBe(false);
    expect(hasActiveFilters({ clientId: 'c1' })).toBe(true);
    expect(hasActiveFilters({ view: 'stalled' })).toBe(true);
  });
});
