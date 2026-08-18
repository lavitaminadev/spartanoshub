import type { JSX } from 'react';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/**
 * Navegación entre páginas de un listado.
 *
 * Muestra el rango real ("41–60 de 213") y no solo el número de página, porque al revisar un
 * listado largo lo que se quiere saber es cuánto falta, no en qué página se está.
 *
 * No se renderiza cuando todo entra en una página: un control de paginación sobre doce filas
 * es ruido.
 */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps): JSX.Element | null {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  if (total === 0 || pages <= 1) return null;

  const actual = Math.min(Math.max(1, page), pages);
  const desde = (actual - 1) * pageSize + 1;
  const hasta = Math.min(actual * pageSize, total);

  return (
    <nav className="pagination" aria-label="Paginación">
      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={actual <= 1}
        onClick={() => onPageChange(actual - 1)}
      >
        Anterior
      </button>

      <span className="pagination-range" aria-live="polite">
        {desde}–{hasta} de {total}
      </span>

      <button
        type="button"
        className="btn btn-outline btn-sm"
        disabled={actual >= pages}
        onClick={() => onPageChange(actual + 1)}
      >
        Siguiente
      </button>
    </nav>
  );
}
