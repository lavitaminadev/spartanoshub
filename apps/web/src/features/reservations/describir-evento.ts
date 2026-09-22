/** Un evento del historial de una reserva, tal como lo devuelve `/reservations/:id/history`. */
export interface EventoDeReserva {
  id: string;
  type: string;
  fromStatus?: string;
  toStatus?: string;
  actorType: string;
  actorName?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

/** Lo que se muestra de un evento: qué pasó, el detalle que lo explica y quién lo hizo. */
export interface EventoDescrito {
  titulo: string;
  detalle?: string;
  autor: string;
  /** Lo hizo el sistema sin que nadie lo viera: se muestra distinto para que no se lea como un hecho observado. */
  supuesto?: boolean;
}

const ESTADOS: Record<string, string> = {
  pending: 'Pendiente', confirmed: 'Confirmada', attended: 'Asistió', no_show: 'No asistió',
  rescheduled: 'Reagendada', cancelled_client: 'Cancelada por quien reservó',
  cancelled_business: 'Cancelada por el local', waitlist: 'Lista de espera',
};

const texto = (valor: unknown) => (typeof valor === 'string' && valor.trim() ? valor.trim() : undefined);

function hora(valor: unknown, zonaHoraria?: string): string | undefined {
  const iso = texto(valor);
  if (!iso) return undefined;
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? undefined : fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zonaHoraria });
}

function autorDe(evento: EventoDeReserva): string {
  const nombre = texto(evento.actorName);
  if (evento.actorType === 'team') return nombre ? `Equipo · ${nombre}` : 'Equipo';
  if (evento.actorType === 'client') return nombre ? `Empresa · ${nombre}` : 'Empresa';
  if (evento.actorType === 'guest') return 'Quien reservó';
  return 'Sistema';
}

/**
 * Cómo se lee un evento del historial.
 *
 * Todo lo que hizo el sistema por su cuenta dice por qué y qué no garantiza: una asistencia
 * supuesta o una salida tomada del cierre del local no son lo que alguien vio, y así lo dice.
 */
export function describirEvento(evento: EventoDeReserva, zonaHoraria?: string): EventoDescrito {
  const datos = evento.metadata ?? {};
  const autor = autorDe(evento);
  const base = (titulo: string, detalle?: string, supuesto?: boolean): EventoDescrito => ({ titulo, detalle, autor, supuesto });

  switch (evento.type) {
    case 'created':
      return base('Reserva creada', datos.manual ? 'Anotada por el equipo.' : undefined);
    case 'cancelled':
      return base('Cancelada por quien reservó', 'Desde su enlace de gestión.');
    case 'rescheduled': {
      const antes = hora(datos.previousStartsAt ?? datos.from, zonaHoraria);
      const despues = hora(datos.startsAt ?? datos.to, zonaHoraria);
      return base('Reagendada', antes && despues ? `De las ${antes} a las ${despues}.` : undefined);
    }
    case 'waitlist_joined':
      return base('Entró a la lista de espera');
    case 'guest_confirmed':
      return base('Quien reservó confirmó que viene');
    case 'marketing_consent':
      return base('Aceptó recibir beneficios y novedades');
    case 'integration_failed':
      return base('Integración pendiente', texto(datos.provider) ? `No se pudo enviar a ${texto(datos.provider)}. Se reintenta sola.` : undefined);
    case 'extended': {
      const hasta = hora(datos.to, zonaHoraria);
      const aviso = datos.overCapacity ? ' Puede dejar la franja sobre el cupo: revisa las reservas que vienen.' : '';
      return base('Sigue en la mesa', `${hasta ? `Se alargó hasta las ${hasta}` : 'Se alargó'} (+${Number(datos.minutes) || 30} min).${aviso}`);
    }
    case 'departed': {
      const salida = hora(datos.leftAt, zonaHoraria);
      if (datos.source === 'local_closed') {
        const cual = datos.tope === 'fin_alargado' ? 'el fin alargado de la reserva'
          : datos.tope === 'fin_previsto' ? 'el fin previsto de la reserva, porque el local no tenía horario ese día'
            : 'el cierre del local';
        return base('Cerrada automáticamente por el sistema', `Nadie marcó la salida. Se tomó ${cual}${salida ? ` (${salida})` : ''} como hora máxima: no es la hora real en que se fue, y no cuenta en la duración promedio de las visitas.`, true);
      }
      const prevista = hora(datos.plannedEndsAt, zonaHoraria);
      return base('Se fue', `${salida ? `Salió a las ${salida}` : 'Salió'}${prevista ? `; estaba prevista hasta las ${prevista}` : ''}. El lugar quedó libre.`);
    }
    case 'status_changed': {
      if (datos.via === 'automatic_day_close') {
        return base('Asistencia supuesta por el sistema', `Nadie marcó si llegó. Pasados ${Number(datos.afterMinutes) || 60} min del fin de la reserva, el sistema la dio por asistida: no confirma que la persona haya venido.`, true);
      }
      if (datos.via === 'exception_day_close') {
        return base('Asistencia marcada al cerrar el día', texto(datos.reason) ? `Motivo: ${texto(datos.reason)}.` : 'Se cerró el día y las reservas abiertas quedaron como asistidas.', true);
      }
      const estado = evento.toStatus ? ESTADOS[evento.toStatus] : undefined;
      const motivo = texto(datos.cancellationReason);
      return base(estado ?? 'Cambio de estado', motivo ? `Motivo: ${motivo}.` : evento.fromStatus && ESTADOS[evento.fromStatus] ? `Antes: ${ESTADOS[evento.fromStatus]}.` : undefined);
    }
    default:
      return base('Cambio registrado');
  }
}
