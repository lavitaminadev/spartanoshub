import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * @fileoverview Estado de filtros guardado en la dirección de la página.
 *
 * Un filtro en estado local se pierde en cuanto pasa cualquier cosa: volver atrás desde el
 * detalle devuelve la lista sin filtrar, recargar borra el trabajo, y no se puede mandar por
 * mensaje «mira esta vista». En la dirección, las tres cosas salen gratis.
 *
 * `FilterBar` pone la forma; esto pone dónde vive el valor. Se separan porque una pantalla puede
 * querer la barra sin tocar la dirección —un cuadro de diálogo, por ejemplo— y al revés.
 */

/** Lo que la pantalla necesita para dibujar y mover sus filtros. */
export interface UrlFilters {
  /** Valor actual de cada clave. Vacío significa «todos». */
  values: Record<string, string>;
  /** Texto de búsqueda libre, bajo la clave `q`. */
  search: string;
  setSearch: (value: string) => void;
  setValue: (key: string, value: string) => void;
  clear: () => void;
  /** Si hay algo filtrado. Sirve para distinguir «no hay nada» de «tu filtro no encontró nada». */
  hasAny: boolean;
}

/**
 * Lee y escribe los filtros de una pantalla en su dirección.
 *
 * @param keys - Claves que esta pantalla filtra. Solo estas se leen y se limpian, de modo que
 *   una pantalla no borra parámetros ajenos —una pestaña abierta, un identificador de detalle—
 *   al limpiar sus propios filtros.
 */
export function useUrlFilters(keys: readonly string[]): UrlFilters {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const resultado: Record<string, string> = {};
    for (const key of keys) resultado[key] = params.get(key) ?? '';
    return resultado;
    // `params` cambia de identidad en cada navegación, que es justo cuando toca releer.
  }, [params, keys]);

  const search = params.get('q') ?? '';

  /**
   * Escribe un valor y borra la clave cuando queda vacía.
   *
   * Sin ese borrado la dirección acumula `?estado=&area=&q=`, que es ruido al compartirla y
   * hace que «sin filtrar» y «filtrado por nada» se vean distintos sin serlo.
   */
  const write = useCallback((key: string, value: string) => {
    setParams((anteriores) => {
      const siguientes = new URLSearchParams(anteriores);
      if (value) siguientes.set(key, value);
      else siguientes.delete(key);
      return siguientes;
      // `replace` para que filtrar no llene el historial: volver atrás debe salir de la lista,
      // no deshacer letra por letra lo que se escribió en el buscador.
    }, { replace: true });
  }, [setParams]);

  const clear = useCallback(() => {
    setParams((anteriores) => {
      const siguientes = new URLSearchParams(anteriores);
      for (const key of [...keys, 'q']) siguientes.delete(key);
      return siguientes;
    }, { replace: true });
  }, [setParams, keys]);

  return {
    values,
    search,
    setSearch: useCallback((value: string) => write('q', value), [write]),
    setValue: write,
    clear,
    hasAny: Boolean(search.trim()) || keys.some((key) => params.get(key)),
  };
}
