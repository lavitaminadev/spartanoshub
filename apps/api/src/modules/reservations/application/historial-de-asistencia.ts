/**
 * @fileoverview Lo que el historial de asistencia dice de un comensal y de un local.
 *
 * Son funciones puras sobre reservas ya leídas: el servicio decide qué filas traer y dentro de qué
 * empresa; aquí sólo se cuenta. Ninguna devuelve el teléfono ni el correo que se usó para agrupar.
 */
import { zonedParts } from '../domain/timezone';

export interface ReservaParaContar {
  id: string;
  status: string;
  startsAt: Date;
}

export interface ResumenDelComensal {
  /** Reservas anteriores que ya tienen un desenlace: asistió, no se presentó o canceló. */
  conDesenlace: number;
  asistio: number;
  noAsistio: number;
  canceladas: number;
  /** `noAsistio` sobre quienes tenían que presentarse (asistió + no asistió). `null` si ninguna. */
  proporcionNoShow: number | null;
  frase: string;
  ultimas: Array<{ id: string; startsAt: Date; status: string }>;
}

const ESTADOS_CANCELADOS = new Set(['cancelled', 'cancelled_client', 'cancelled_business']);

function veces(cantidad: number): string {
  return cantidad === 1 ? '1 vez' : `${cantidad} veces`;
}

/**
 * Resume cómo ha respondido un comensal a sus reservas anteriores.
 *
 * Sólo cuentan las que ya pasaron y tienen desenlace: una reserva futura o pendiente no es una
 * asistencia ni una falta. Las canceladas se informan aparte y no entran en la proporción, porque
 * avisar que no se viene no es lo mismo que no presentarse.
 *
 * @param anteriores - Reservas de la misma empresa y el mismo comensal, sin la actual.
 * @param ahora - Instante de referencia; lo que empieza después no se cuenta.
 */
export function resumirAsistenciaDelComensal(anteriores: readonly ReservaParaContar[], ahora: Date): ResumenDelComensal {
  const pasadas = anteriores.filter((reserva) => reserva.startsAt.getTime() <= ahora.getTime());
  const asistio = pasadas.filter((reserva) => reserva.status === 'attended').length;
  const noAsistio = pasadas.filter((reserva) => reserva.status === 'no_show').length;
  const canceladas = pasadas.filter((reserva) => ESTADOS_CANCELADOS.has(reserva.status)).length;
  const debianPresentarse = asistio + noAsistio;

  let frase = 'Sin reservas anteriores con resultado en esta empresa.';
  if (debianPresentarse > 0) {
    frase = noAsistio === 0
      ? `Se presentó ${veces(asistio)} de ${debianPresentarse}.`
      : `No se presentó ${noAsistio} de ${debianPresentarse} ${debianPresentarse === 1 ? 'vez' : 'veces'}.`;
  }

  return {
    conDesenlace: asistio + noAsistio + canceladas,
    asistio,
    noAsistio,
    canceladas,
    proporcionNoShow: debianPresentarse > 0 ? noAsistio / debianPresentarse : null,
    frase,
    ultimas: [...pasadas]
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
      .slice(0, 5)
      .map((reserva) => ({ id: reserva.id, startsAt: reserva.startsAt, status: reserva.status })),
  };
}

export interface ReservaDeUnLocal extends ReservaParaContar {
  formId: string;
}

export interface LocalParaContar {
  id: string;
  nombre: string;
  clientId: string;
  timezone: string;
}

export interface NoShowDeUnDia {
  /** 0 = domingo … 6 = sábado, en la hora del local. */
  dia: number;
  nombre: string;
  total: number;
  noAsistio: number;
  tasa: number | null;
}

export interface NoShowDeUnLocal {
  formId: string;
  nombre: string;
  clientId: string;
  total: number;
  noAsistio: number;
  tasa: number | null;
  porDia: NoShowDeUnDia[];
  /** El día con más faltas, sólo si tiene muestra suficiente para decirlo. */
  peorDia: { nombre: string; tasa: number; frase: string } | null;
}

const NOMBRE_DEL_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
/** Menos reservas que esto en un día y la tasa dice más del azar que del local. */
export const MUESTRA_MINIMA_POR_DIA = 5;

function tasaDe(noAsistio: number, total: number): number | null {
  return total > 0 ? noAsistio / total : null;
}

/**
 * La tasa de no-show de cada local, por día de la semana.
 *
 * El día se toma en la hora del local, no en UTC: una reserva de las 22:00 del jueves en Santiago
 * ya es viernes en UTC. Sólo cuentan las asistidas y las no presentadas; cancelar a tiempo no
 * es faltar.
 */
export function noShowPorLocalYDia(reservas: readonly ReservaDeUnLocal[], locales: readonly LocalParaContar[]): NoShowDeUnLocal[] {
  return locales.map((local) => {
    const dias: NoShowDeUnDia[] = NOMBRE_DEL_DIA.map((nombre, dia) => ({ dia, nombre, total: 0, noAsistio: 0, tasa: null }));
    for (const reserva of reservas) {
      if (reserva.formId !== local.id) continue;
      if (reserva.status !== 'attended' && reserva.status !== 'no_show') continue;
      const fila = dias[zonedParts(reserva.startsAt, local.timezone).weekday];
      fila.total += 1;
      if (reserva.status === 'no_show') fila.noAsistio += 1;
    }
    for (const fila of dias) fila.tasa = tasaDe(fila.noAsistio, fila.total);

    const total = dias.reduce((suma, fila) => suma + fila.total, 0);
    const noAsistio = dias.reduce((suma, fila) => suma + fila.noAsistio, 0);
    const candidatos = dias.filter((fila) => fila.total >= MUESTRA_MINIMA_POR_DIA && fila.noAsistio > 0);
    const peor = candidatos.sort((a, b) => (b.tasa ?? 0) - (a.tasa ?? 0))[0];
    return {
      formId: local.id,
      nombre: local.nombre,
      clientId: local.clientId,
      total,
      noAsistio,
      tasa: tasaDe(noAsistio, total),
      porDia: dias,
      peorDia: peor && peor.tasa !== null
        ? { nombre: peor.nombre, tasa: peor.tasa, frase: `Los ${peor.dia === 0 || peor.dia === 6 ? `${peor.nombre}s` : peor.nombre} falla el ${Math.round(peor.tasa * 100)}%.` }
        : null,
    };
  });
}
