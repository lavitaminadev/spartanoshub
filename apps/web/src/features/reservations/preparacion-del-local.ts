/**
 * @fileoverview Si una reserva puede recibir gente, y qué le falta si no.
 *
 * «Publicada / Borrador» describe el estado del registro, no lo que le pasa a quien abre el
 * enlace: una reserva publicada pero pausada sigue diciendo «Publicada» mientras nadie puede
 * reservar. Y para saber por qué una no se puede publicar había que recorrer el constructor paso
 * a paso, porque lo que falta está repartido entre cuatro pantallas.
 */

import type { ReservationForm } from './types';

export interface EstadoDelCanal {
  etiqueta: string;
  detalle: string;
  tono: 'abierto' | 'pausado' | 'cerrado';
}

/** Una pausa vencida no es una pausa: la página vuelve sola a ofrecer horarios. */
function pausaVigente(local: ReservationForm): string {
  const hasta = (local.designConfig as Record<string, string | undefined> | undefined)?.bookingPausedUntil;
  return hasta && new Date(hasta) > new Date() ? hasta : '';
}

export function estadoDelCanal(local: ReservationForm): EstadoDelCanal {
  if (local.status === 'draft') {
    return {
      etiqueta: 'Sin publicar',
      detalle: 'Nadie puede reservar todavía: termina lo que falta y publica el enlace.',
      tono: 'cerrado',
    };
  }
  const hasta = pausaVigente(local);
  // Pausada es un estado propio: el enlace existe y está publicado, pero no ofrece horarios.
  if (hasta || local.status !== 'published') {
    const cuando = hasta ? new Date(hasta).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' }) : '';
    return {
      etiqueta: 'Pausada',
      detalle: cuando ? `No se ofrecen horarios hasta el ${cuando}.` : 'No se ofrecen horarios nuevos.',
      tono: 'pausado',
    };
  }
  return { etiqueta: 'Recibiendo reservas', detalle: 'El enlace está abierto y ofrece horarios.', tono: 'abierto' };
}

export interface RequisitoDelLocal {
  clave: string;
  nombre: string;
  listo: boolean;
  detalle: string;
}

/**
 * Lo que hay que tener resuelto para abrir el enlace, con lo que hay puesto hoy.
 *
 * @returns Un requisito por fila, en el orden en que conviene resolverlos.
 */
export function loQueFaltaParaAbrir(local: ReservationForm): RequisitoDelLocal[] {
  const franjas = (local.scheduleConfig as { windows?: unknown[] } | undefined)?.windows?.length ?? 0;
  const campos = local.fieldSchema?.length ?? 0;
  return [
    {
      clave: 'horario',
      nombre: 'Días y horarios de atención',
      listo: franjas > 0,
      detalle: franjas > 0 ? `${franjas} ${franjas === 1 ? 'franja' : 'franjas'} declaradas` : 'Sin franjas: no hay ninguna hora que ofrecer',
    },
    {
      clave: 'cupo',
      nombre: 'Personas por franja',
      listo: (local.capacityPerSlot ?? 0) > 0,
      detalle: (local.capacityPerSlot ?? 0) > 0 ? `${local.capacityPerSlot} por horario` : 'Sin definir',
    },
    {
      clave: 'duracion',
      nombre: 'Duración de cada reserva',
      listo: (local.durationMinutes ?? 0) > 0,
      detalle: (local.durationMinutes ?? 0) > 0 ? `${local.durationMinutes} minutos` : 'Sin definir',
    },
    {
      clave: 'campos',
      nombre: 'Datos que se piden',
      listo: campos > 0,
      detalle: campos > 0 ? `${campos} ${campos === 1 ? 'campo' : 'campos'}` : 'Sin campos',
    },
  ];
}
