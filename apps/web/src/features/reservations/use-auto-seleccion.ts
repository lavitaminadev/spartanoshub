import { useEffect } from 'react';

/**
 * Selecciona sola la unica opcion disponible.
 *
 * Las vistas de operacion piden empresa y local antes de mostrar nada. Cuando la lista trae un
 * solo elemento —el caso normal de quien recibe las reservas, que tiene su local y ninguno mas—
 * esa eleccion no informa de nada y deja la pantalla en un estado vacio que parece un error.
 *
 * No decide por el usuario cuando hay mas de una opcion: ahi elegir si dice algo.
 */
export function useAutoSeleccionUnica(
  opciones: Array<{ id: string }>,
  valor: string,
  elegir: (id: string) => void,
): void {
  useEffect(() => {
    if (valor || opciones.length !== 1) return;
    const unica = opciones[0]?.id;
    if (unica) elegir(unica);
  }, [opciones, valor, elegir]);
}
