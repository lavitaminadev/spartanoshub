/**
 * @fileoverview De qué origen vino cada reserva, y de ésas, cuántas personas llegaron.
 *
 * Es la pregunta que un local no puede responder hoy con ninguna herramienta: no «cuántos clics
 * tuvo el anuncio» ni «cuántas reservas entraron», sino **cuántas de esas reservas se sentaron a
 * la mesa**. Meta y Google informan lo primero; la caja informa lo tercero; nadie une las dos
 * puntas, porque el dato que las une —la asistencia marcada— vive en el sistema del local.
 *
 * Se calcula sobre lo que la reserva ya guarda: `originDetected`, `utmCampaign` y `status`. No
 * añade seguimiento, no pone cookies y no consulta a terceros: sólo cuenta lo que ya está escrito.
 *
 * **Sólo entran las reservas cerradas** —`attended` o `no_show`—. Una reserva de mañana no dice
 * nada sobre si alguien llegó, y mezclarla hunde el porcentaje de cualquier campaña reciente, que
 * es justo la que se está evaluando.
 */

/** Lo que hace falta de una reserva para contarla. Nada de datos de la persona. */
export interface ReservaParaAtribuir {
  status: string;
  /** El origen: `facebook`, `google`, `instagram`… Es `utm_source`, el que llega en el enlace. */
  utmSource?: string | null;
  utmCampaign?: string | null;
  /**
   * Si la reserva llegó con algún rastro de origen.
   *
   * Es una bandera y no el nombre del origen: distingue «vino sin campaña» de «vino con campaña
   * y sin nombre», que no son lo mismo. Lo segundo es un enlace mal armado, y conviene que se vea
   * en vez de sumarse a lo directo.
   */
  originDetected?: boolean | null;
  partySize?: number | null;
  /** Hubo recordatorio y la persona confirmó: dice si el aviso sirvió en ese origen. */
  reminderSentAt?: Date | null;
  guestConfirmedAt?: Date | null;
}

export interface AsistenciaDeUnOrigen {
  /** `facebook`, `google`, `directo`, `sin_identificar`. Sale de `utm_source`. */
  origen: string;
  /** La campaña, cuando la reserva la trae. `null` se agrupa aparte y no se inventa. */
  campana: string | null;
  reservas: number;
  llegaron: number;
  noLlegaron: number;
  /** Personas que de verdad se sentaron, sumando el tamaño de cada mesa que llegó. */
  comensales: number;
  /** Porcentaje de asistencia, redondeado. `null` bajo la muestra mínima. */
  asistencia: number | null;
  /** De las que llegaron, cuántas habían confirmado tras el recordatorio. */
  confirmadasTrasRecordatorio: number;
}

/**
 * Bajo esta cantidad de reservas cerradas no se publica un porcentaje.
 *
 * Con tres reservas, una ausencia son treinta y tres puntos: un número así invita a apagar una
 * campaña que no se ha medido. Se entregan los conteos —que son hechos— y se omite el porcentaje,
 * que con esa muestra es una opinión.
 */
export const MUESTRA_MINIMA_POR_ORIGEN = 10;

/** Qué se considera «llegó». El resto de los estados cerrados es una ausencia. */
const LLEGO = 'attended';

export function asistenciaPorOrigen(reservas: readonly ReservaParaAtribuir[]): AsistenciaDeUnOrigen[] {
  const grupos = new Map<string, AsistenciaDeUnOrigen>();

  for (const reserva of reservas) {
    if (reserva.status !== LLEGO && reserva.status !== 'no_show') continue;

    /*
     * Tres casos, y ninguno se descarta.
     *
     * Sin rastro es `directo`: una reserva que llegó sola sigue siendo una reserva, y esconderla
     * hace que las campañas parezcan responsables de todo el local. Con rastro y sin nombre es
     * `sin_identificar`, que casi siempre es un enlace mal armado: sumarlo a lo directo esconde
     * justo el error que hay que arreglar.
     */
    const fuente = (reserva.utmSource ?? '').trim();
    const origen = fuente || (reserva.originDetected ? 'sin_identificar' : 'directo');
    const campana = (reserva.utmCampaign ?? '').trim() || null;
    const clave = `${origen}\u0000${campana ?? ''}`;

    const fila = grupos.get(clave) ?? {
      origen, campana, reservas: 0, llegaron: 0, noLlegaron: 0, comensales: 0,
      asistencia: null, confirmadasTrasRecordatorio: 0,
    };

    fila.reservas += 1;
    if (reserva.status === LLEGO) {
      fila.llegaron += 1;
      // Una mesa sin cantidad cuenta como una persona: hubo alguien, aunque no se anotó cuántos.
      fila.comensales += Math.max(1, Math.trunc(reserva.partySize ?? 1));
      if (reserva.reminderSentAt && reserva.guestConfirmedAt) fila.confirmadasTrasRecordatorio += 1;
    } else {
      fila.noLlegaron += 1;
    }

    grupos.set(clave, fila);
  }

  for (const fila of grupos.values()) {
    fila.asistencia = fila.reservas >= MUESTRA_MINIMA_POR_ORIGEN
      ? Math.round((fila.llegaron / fila.reservas) * 100)
      : null;
  }

  /*
   * Primero los que más gente sentaron.
   *
   * No por porcentaje: una campaña con el cien por ciento sobre doce reservas importa menos que
   * una con el setenta sobre trescientas, y ordenar por porcentaje pone arriba justo a la que
   * menos mueve. Empates por reservas, y luego por nombre para que el orden no baile entre
   * consultas.
   */
  return [...grupos.values()].sort((uno, otro) =>
    otro.comensales - uno.comensales
    || otro.reservas - uno.reservas
    || `${uno.origen}${uno.campana ?? ''}`.localeCompare(`${otro.origen}${otro.campana ?? ''}`));
}
