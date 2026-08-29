/**
 * Cuánto lleva un lead parado, y si eso ya es un problema.
 *
 * La cuenta se hace sobre `stageChangedAt` y no sobre `updatedAt`: corregir un teléfono o añadir
 * una nota no es un paso del embudo, y contarlo como tal hacía que el lead más manoseado fuera el
 * que nunca avisaba de estar parado.
 *
 * Los tres plazos son ajustes de la organización y no números fijos, porque el ritmo depende del
 * negocio: en un ciclo de venta de dos semanas, tres días parado es alarmante; en uno de seis
 * meses no significa nada. Un aviso que no significa nada enseña a ignorar todos los demás.
 */

/** Gravedad de la inactividad. `null` cuando el lead todavía está dentro de plazo. */
export type NivelDeInactividad = 'notice' | 'warning' | 'critical' | null;

/** Los tres plazos, en días. */
export interface PlazosDeInactividad {
  notice: number;
  warning: number;
  critical: number;
}

/** Lo que se le añade a un lead para que la pantalla no tenga que calcularlo. */
export interface Inactividad {
  /** Días completos sin cambiar de etapa. */
  idleDays: number;
  idleLevel: NivelDeInactividad;
}

/** Claves de los ajustes. Una sola definición: el catálogo y quien las lee no pueden divergir. */
export const CLAVE_AVISO = 'crm.lead_idle_days_notice';
export const CLAVE_ALERTA = 'crm.lead_idle_days_warning';
export const CLAVE_ABANDONO = 'crm.lead_idle_days_critical';

/** Valores de fábrica, iguales a los del catálogo de ajustes. */
export const PLAZOS_POR_DEFECTO: PlazosDeInactividad = { notice: 3, warning: 5, critical: 7 };

const UN_DIA = 86_400_000;

/**
 * Etapas que ya terminaron.
 *
 * Un lead vendido o descartado lleva parado por definición, y avisar de ellos llenaría el tablero
 * de alertas sobre trabajo que ya está hecho —que es la forma más rápida de que se dejen de
 * mirar—.
 */
const CERRADAS = new Set(['won', 'lost', 'attended', 'no_show']);

/**
 * Días parados y gravedad de un lead.
 *
 * @param lead - Necesita su etapa y cuándo entró en ella. Sin fecha se toma la de creación: un
 *   lead que nunca cambió de etapa lleva parado desde que entró, y esa es la verdad que la alerta
 *   tiene que dar.
 * @param plazos - Los de la organización, o los de fábrica.
 * @param ahora - Inyectable para poder probarlo sin depender del reloj.
 */
export function inactividadDe(
  lead: { status: string; stageChangedAt?: Date | string | null; createdAt?: Date | string | null },
  plazos: PlazosDeInactividad = PLAZOS_POR_DEFECTO,
  ahora: Date = new Date(),
): Inactividad {
  const referencia = lead.stageChangedAt ?? lead.createdAt;
  if (!referencia || CERRADAS.has(lead.status)) return { idleDays: 0, idleLevel: null };

  const desde = referencia instanceof Date ? referencia : new Date(referencia);
  if (Number.isNaN(desde.getTime())) return { idleDays: 0, idleLevel: null };

  const idleDays = Math.floor((ahora.getTime() - desde.getTime()) / UN_DIA);
  if (idleDays < 0) return { idleDays: 0, idleLevel: null };

  /*
   * Se comprueba de mayor a menor.
   *
   * Al revés, un lead de nueve días saldría como «aviso» —el primer umbral que supera— en vez de
   * como abandonado. Y nada obliga a que los tres plazos estén ordenados: son ajustes que alguien
   * escribe a mano, y este orden hace que el peor caso siempre gane.
   */
  if (idleDays >= plazos.critical) return { idleDays, idleLevel: 'critical' };
  if (idleDays >= plazos.warning) return { idleDays, idleLevel: 'warning' };
  if (idleDays >= plazos.notice) return { idleDays, idleLevel: 'notice' };
  return { idleDays, idleLevel: null };
}
