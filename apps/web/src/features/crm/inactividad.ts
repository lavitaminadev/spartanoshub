/**
 * Cómo se ve un lead que lleva días parado.
 *
 * El nivel lo decide el servidor —los plazos son un ajuste de la organización y solo un
 * administrador puede leerlos—, así que acá no se calcula nada: solo se traduce a palabras y a
 * una clase de estilo.
 *
 * Tres niveles y no uno, porque «tres días sin tocar» y «dos semanas abandonado» piden cosas
 * distintas: el primero es un recordatorio y el último es un lead que se está perdiendo. Con un
 * solo aviso, o llega tarde para los que corren o satura para los que no.
 */

/** Gravedad tal como la manda el servidor. */
export type NivelDeInactividad = 'notice' | 'warning' | 'critical' | null;

/** Qué se muestra en cada nivel. El orden es de menor a mayor gravedad. */
const ROTULOS: Record<Exclude<NivelDeInactividad, null>, { texto: string; titulo: string }> = {
  notice: { texto: 'Sin mover', titulo: 'Lleva días sin cambiar de etapa' },
  warning: { texto: 'Se está enfriando', titulo: 'Bastantes días sin avanzar: conviene retomarlo' },
  critical: { texto: 'Abandonado', titulo: 'Lleva demasiado sin moverse; decide si sigue vivo' },
};

/**
 * Texto, título y clase de la marca de inactividad.
 *
 * @param nivel - El que envía el servidor con cada lead.
 * @param dias - Días completos sin cambiar de etapa. Se muestran junto al rótulo porque «sin
 *   mover» no dice cuánto, y cuánto es lo que decide si se llama hoy o la semana que viene.
 * @returns `null` cuando el lead está dentro de plazo y no hay nada que marcar.
 */
export function marcaDeInactividad(
  nivel: NivelDeInactividad,
  dias: number,
): { texto: string; titulo: string; clase: string } | null {
  if (!nivel) return null;
  const { texto, titulo } = ROTULOS[nivel];
  return {
    texto: `${texto} · ${dias} ${dias === 1 ? 'día' : 'días'}`,
    titulo,
    clase: `leads-board-inactivo es-${nivel}`,
  };
}
