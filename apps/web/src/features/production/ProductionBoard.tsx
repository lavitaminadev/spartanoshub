import { useMemo } from 'react';
import { BOARD_COLUMNS, groupByColumn, isStalled, type BoardArea, type BoardItem } from './board-columns';
import { applyBoardFilters, BOARD_VIEW_LABELS, hasActiveFilters, type BoardFilters, type BoardView } from './board-filters';
import { PIECE_STATUS_LABELS } from './production-labels';

export interface ProductionBoardProps {
  area: BoardArea;
  items: readonly BoardItem[];
  filters: BoardFilters;
  onFiltersChange: (filters: BoardFilters) => void;
  /** Umbral de `production.stale_hours`; llega resuelto para no consultarlo por tarjeta. */
  staleHours: number;
  /** Opciones que llenan los selectores; vienen del catálogo y de la cartera de quien mira. */
  clients?: readonly { id: string; name: string }[];
  types?: readonly { key: string; label: string }[];
  onOpenItem?: (id: string) => void;
  /** Identificadores recién creados, para destacarlos al llegar desde otra acción. */
  highlightIds?: readonly string[];
}

/**
 * Tablero de producción por área.
 *
 * Reutiliza las clases del tablero comercial (`kanban`, `kanban-column`, `kanban-card`) a
 * propósito: ya están resueltas para pantallas chicas y con dos hojas de estilo distintas los
 * tableros terminarían viéndose distinto sin que nadie lo hubiera decidido.
 *
 * No arrastra tarjetas entre columnas. Mover una pieza de etapa no es reordenar: cada avance
 * tiene su regla —entregar reserva presupuesto, aprobar exige atribución— y un arrastre las
 * saltaría todas. El avance se hace desde la ficha, donde el sistema puede exigir lo que falte.
 */
export function ProductionBoard({
  area, items, filters, onFiltersChange, staleHours,
  clients = [], types = [], onOpenItem, highlightIds = [],
}: ProductionBoardProps) {
  const columns = BOARD_COLUMNS[area];

  const visibles = useMemo(
    () => applyBoardFilters(items, filters, { staleHours }),
    [items, filters, staleHours],
  );
  const grouped = useMemo(() => groupByColumn(visibles, columns), [visibles, columns]);
  const destacados = useMemo(() => new Set(highlightIds), [highlightIds]);

  const set = (patch: Partial<BoardFilters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <section className="production-board" aria-label={`Tablero de ${area === 'design' ? 'Arte' : 'Audiovisual'}`}>
      <div className="board-filters">
        <div className="board-views" role="group" aria-label="Vistas rápidas">
          {(Object.keys(BOARD_VIEW_LABELS) as BoardView[]).map((view) => (
            <button
              key={view}
              type="button"
              className={`chip ${(filters.view ?? 'all') === view ? 'is-active' : ''}`}
              aria-pressed={(filters.view ?? 'all') === view}
              onClick={() => set({ view })}
            >
              {BOARD_VIEW_LABELS[view]}
            </button>
          ))}
        </div>

        <div className="board-selects">
          <label>
            <span className="sr-only">Cliente</span>
            <select value={filters.clientId ?? ''} onChange={(event) => set({ clientId: event.target.value || undefined })}>
              <option value="">Todos los clientes</option>
              {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
            </select>
          </label>

          <label>
            <span className="sr-only">Tipo de pieza</span>
            <select value={filters.type ?? ''} onChange={(event) => set({ type: event.target.value || undefined })}>
              <option value="">Todos los tipos</option>
              {types.map((type) => <option key={type.key} value={type.key}>{type.label}</option>)}
            </select>
          </label>

          <label>
            <span className="sr-only">Buscar por título</span>
            <input
              type="search"
              placeholder="Buscar…"
              value={filters.search ?? ''}
              onChange={(event) => set({ search: event.target.value || undefined })}
            />
          </label>

          {hasActiveFilters(filters) && (
            <button type="button" className="link-button" onClick={() => onFiltersChange({})}>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      <div className="kanban production-kanban">
        {columns.map((column) => {
          const cards = grouped[column.key] ?? [];
          return (
            <div key={column.key} className="kanban-column">
              <div className="kanban-header">
                <div>
                  <strong>{column.title}</strong>
                  <small>{column.hint}</small>
                </div>
                <span className="kanban-count">{cards.length}</span>
              </div>

              <div className="kanban-cards">
                {cards.length === 0 && <div className="kanban-empty">Sin trabajo en esta etapa</div>}

                {cards.map((item) => {
                  const detenida = isStalled(item, staleHours);
                  return (
                    <article
                      key={item.id}
                      className={`kanban-card production-card ${detenida ? 'is-stalled' : ''} ${destacados.has(item.id) ? 'is-highlighted' : ''}`}
                      onClick={() => onOpenItem?.(item.id)}
                      role={onOpenItem ? 'button' : undefined}
                      tabIndex={onOpenItem ? 0 : undefined}
                      onKeyDown={(event) => {
                        if (onOpenItem && (event.key === 'Enter' || event.key === ' ')) {
                          event.preventDefault();
                          onOpenItem(item.id);
                        }
                      }}
                    >
                      <h4>{String(item.title ?? 'Sin título')}</h4>
                      <div className="production-card-meta">
                        {Boolean(item.clientName) && <span>{String(item.clientName)}</span>}
                        {Boolean(item.typeLabel ?? item.type) && <span>{String(item.typeLabel ?? item.type)}</span>}
                      </div>
                      <footer>
                        <small>{PIECE_STATUS_LABELS[item.status] ?? item.status}</small>
                        {Number(item.udAmount) > 0 && <small>{Number(item.udAmount)} UD</small>}
                        {/* El aviso de detenida va en la tarjeta y no solo en el filtro: el
                            objetivo es que se note sin tener que ir a buscarlo. */}
                        {detenida && <small className="badge-warning">Sin movimiento</small>}
                      </footer>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
