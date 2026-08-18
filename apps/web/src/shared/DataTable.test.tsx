import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataTable, type Column } from './DataTable';

interface Fila { id: string; nombre: string; monto: number }

const columnas: Column<Fila>[] = [
  { key: 'nombre', label: 'Nombre', sortable: true },
  { key: 'monto', label: 'Monto', sortable: true },
];

const filas: Fila[] = [
  { id: '2', nombre: 'Beta', monto: 20 },
  { id: '1', nombre: 'Alfa', monto: 100 },
];

const base = { columns: columnas, keyExtractor: (row: Fila) => row.id };

describe('DataTable en memoria', () => {
  it('ordena por la columna elegida', () => {
    render(<DataTable {...base} data={filas} />);
    fireEvent.click(screen.getByText('Nombre'));
    const celdas = screen.getAllByText(/Alfa|Beta/);
    expect(celdas[0].textContent).toBe('Alfa');
  });

  /**
   * Comparar como texto haría que 100 quedara antes que 20. Es el fallo clásico de ordenar
   * montos, y el que más se nota porque afecta justo a las filas grandes.
   */
  it('ordena números como números', () => {
    render(<DataTable {...base} data={filas} />);
    fireEvent.click(screen.getByText('Monto'));
    const celdas = screen.getAllByText(/^(20|100)$/);
    expect(celdas[0].textContent).toBe('20');
  });
});

describe('DataTable con paginación de servidor', () => {
  const paginacion = {
    page: 2,
    pageSize: 20,
    total: 213,
    onPageChange: vi.fn(),
  };

  /**
   * El contador decía cuántas filas trajo la página, no cuántas existen. En un listado
   * paginado eso es engañoso: quien lee «20 registros» sobre un total de 213 concluye que hay
   * veinte.
   */
  it('cuenta el total, no las filas de esta página', () => {
    render(<DataTable {...base} data={filas} serverPagination={paginacion} exportFileName="prueba" />);
    expect(screen.getByText('213 registros')).toBeTruthy();
  });

  it('muestra el rango real de la página', () => {
    render(<DataTable {...base} data={filas} serverPagination={paginacion} />);
    expect(screen.getByText('21–40 de 213')).toBeTruthy();
  });

  it('pide la página siguiente en vez de recortar en memoria', () => {
    const onPageChange = vi.fn();
    render(<DataTable {...base} data={filas} serverPagination={{ ...paginacion, onPageChange }} />);
    fireEvent.click(screen.getByText('Siguiente'));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  /**
   * Ordenar una página contra el total daría un orden que solo vale dentro de esa página: las
   * filas se reacomodan en pantalla pero la página siguiente sigue siendo la misma.
   */
  it('delega el orden al servidor y no reordena localmente', () => {
    const onSortChange = vi.fn();
    render(<DataTable {...base} data={filas} serverPagination={{ ...paginacion, onSortChange, sortKey: 'nombre', sortDir: 'asc' }} />);

    fireEvent.click(screen.getByText('Nombre'));
    expect(onSortChange).toHaveBeenCalledWith('nombre', 'desc');

    // El orden en pantalla no se tocó: sigue el que llegó del servidor.
    const celdas = screen.getAllByText(/Alfa|Beta/);
    expect(celdas[0].textContent).toBe('Beta');
  });

  it('no ofrece ordenar si nadie va a atenderlo', () => {
    render(<DataTable {...base} data={filas} serverPagination={paginacion} />);
    // Sin `onSortChange`, la cabecera no queda enfocable ni anuncia orden.
    expect(screen.getByText('Nombre').getAttribute('tabindex')).toBeNull();
  });

  /**
   * Una página fuera de rango —tras filtrar o borrar— dejaba la pantalla diciendo «no hay
   * datos» y sin forma de volver a la primera.
   */
  it('conserva la paginación en una página vacía que no es un listado vacío', () => {
    render(<DataTable {...base} data={[]} serverPagination={paginacion} />);
    expect(screen.getByText('Esta página no tiene registros.')).toBeTruthy();
    expect(screen.getByText('Anterior')).toBeTruthy();
  });

  it('un listado realmente vacío no muestra paginación', () => {
    render(<DataTable {...base} data={[]} serverPagination={{ ...paginacion, page: 1, total: 0 }} emptyMessage="Sin oportunidades" />);
    expect(screen.getByText('Sin oportunidades')).toBeTruthy();
    expect(screen.queryByText('Anterior')).toBeNull();
  });
});
