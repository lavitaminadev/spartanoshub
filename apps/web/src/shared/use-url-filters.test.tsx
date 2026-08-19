import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useUrlFilters } from './use-url-filters';

/**
 * Los filtros viven en la dirección para que volver atrás conserve lo filtrado, recargar no
 * borre el trabajo y una vista se pueda mandar por mensaje. Estas pruebas fijan ese contrato y
 * las dos trampas que lo arruinan: dejar claves vacías colgando y borrar parámetros ajenos.
 */
const CLAVES = ['estado', 'area'] as const;

function dibujar(inicial = '/lista') {
  const envoltura = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[inicial]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ filtros: useUrlFilters(CLAVES), ubicacion: useLocation() }), { wrapper: envoltura });
}

describe('filtros en la dirección', () => {
  it('lee los valores que ya vienen en la dirección', () => {
    const { result } = dibujar('/lista?estado=nuevo&q=logo');
    expect(result.current.filtros.values.estado).toBe('nuevo');
    expect(result.current.filtros.search).toBe('logo');
  });

  it('escribe el valor en la dirección al filtrar', () => {
    const { result } = dibujar();
    act(() => result.current.filtros.setValue('area', 'design'));
    expect(result.current.ubicacion.search).toContain('area=design');
  });

  /** `?estado=&area=` es ruido al compartir el enlace y no significa nada distinto de no filtrar. */
  it('borra la clave cuando el valor queda vacío', () => {
    const { result } = dibujar('/lista?estado=nuevo');
    act(() => result.current.filtros.setValue('estado', ''));
    expect(result.current.ubicacion.search).not.toContain('estado');
  });

  it('distingue una lista sin filtrar de una filtrada', () => {
    const { result } = dibujar();
    expect(result.current.filtros.hasAny).toBe(false);
    act(() => result.current.filtros.setSearch('logo'));
    expect(result.current.filtros.hasAny).toBe(true);
  });

  /**
   * Limpiar debe soltar los filtros de esta pantalla y nada más: un identificador de detalle o
   * una pestaña abierta viven en la misma dirección y no son filtros.
   */
  it('al limpiar no toca parámetros ajenos', () => {
    const { result } = dibujar('/lista?estado=nuevo&q=logo&pestana=historial');
    act(() => result.current.filtros.clear());

    expect(result.current.ubicacion.search).not.toContain('estado');
    expect(result.current.ubicacion.search).not.toContain('q=');
    expect(result.current.ubicacion.search).toContain('pestana=historial');
  });

  /** Volver atrás debe salir de la lista, no deshacer letra por letra lo que se escribió. */
  it('filtrar no acumula historial de navegación', () => {
    const { result } = dibujar();
    const largoInicial = window.history.length;
    act(() => result.current.filtros.setSearch('l'));
    act(() => result.current.filtros.setSearch('lo'));
    act(() => result.current.filtros.setSearch('log'));
    expect(window.history.length).toBe(largoInicial);
  });
});
