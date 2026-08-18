import type { JSX, ReactNode } from 'react';

/** Un filtro de selección con sus opciones. */
export interface FilterDefinition {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  /** Texto de la opción vacía. */
  allLabel?: string;
}

export interface FilterBarProps {
  /** Texto de búsqueda libre. Omitir `onSearchChange` oculta el campo. */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  filters?: FilterDefinition[];
  /** Valor actual de cada filtro, por clave. Vacío significa "todos". */
  values?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;

  /** Botones a la derecha: exportar, crear, etc. */
  actions?: ReactNode;

  /**
   * Se llama al pedir limpiar.
   *
   * El botón solo aparece cuando hay algo que limpiar: ofrecer "limpiar filtros" sobre una
   * vista sin filtrar es un control que no hace nada.
   */
  onClear?: () => void;
}

/**
 * Barra de búsqueda y filtros, común a las pantallas de listado.
 *
 * Cada pantalla venía escribiendo su propia fila de `input` y `select` con clases distintas,
 * de modo que el mismo control se veía y se comportaba diferente en cada una. Acá el molde es
 * uno solo; el estado sigue viviendo en la pantalla, que es la que sabe qué significa filtrar
 * en su contexto.
 */
export function FilterBar({
  search, onSearchChange, searchPlaceholder = 'Buscar...',
  filters = [], values = {}, onFilterChange,
  actions, onClear,
}: FilterBarProps): JSX.Element {
  const hayFiltroActivo = Boolean(search?.trim()) || filters.some((filter) => values[filter.key]);

  return (
    <div className="filter-bar">
      <div className="filter-bar-controls">
        {onSearchChange ? (
          <input
            type="search"
            className="input filter-search"
            value={search ?? ''}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        ) : null}

        {filters.map((filter) => (
          <label key={filter.key} className="filter-field">
            <span className="filter-field-label">{filter.label}</span>
            <select
              className="input"
              value={values[filter.key] ?? ''}
              onChange={(event) => onFilterChange?.(filter.key, event.target.value)}
            >
              <option value="">{filter.allLabel ?? 'Todos'}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        ))}

        {onClear && hayFiltroActivo ? (
          <button type="button" className="btn btn-outline btn-sm" onClick={onClear}>Limpiar</button>
        ) : null}
      </div>

      {actions ? <div className="filter-bar-actions">{actions}</div> : null}
    </div>
  );
}
