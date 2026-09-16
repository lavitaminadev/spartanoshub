/**
 * @fileoverview De qué depende cada aviso, además de su interruptor.
 *
 * Un correo encendido puede no salir nunca: el recordatorio y la encuesta los dispara el cron de
 * cPanel, la encuesta necesita además la reserva marcada como asistida y una encuesta elegida, y
 * ninguno sale si la casilla que envía no está configurada. Hasta ahora nada de eso se veía en
 * pantalla, así que un aviso apagado de hecho se leía igual que uno funcionando.
 *
 * Lo que se puede comprobar se comprueba; lo que sólo se puede advertir se advierte.
 */

/** Requisito que el servidor sabe comprobar por sí mismo. */
export type ClaveDeRequisito = 'casilla' | 'cron' | 'encuesta' | 'asistencia' | 'equipo';

export interface RequisitoDeAviso {
  clave: ClaveDeRequisito;
  /** Tarea programada de la que depende, cuando la hay. */
  tarea?: string;
}

/**
 * Requisitos por aviso, con el prefijo de sus claves de configuración.
 *
 * Los avisos que no aparecen sólo dependen de su interruptor y de la casilla que envía: salen en
 * el acto, dentro de la misma petición que los provoca.
 */
export const REQUISITOS_POR_AVISO: Record<string, RequisitoDeAviso[]> = {
  'email.reservation_reminder': [{ clave: 'cron', tarea: 'recordatorio-reservas' }],
  'email.post_visit_survey': [
    { clave: 'cron', tarea: 'encuesta-post-visita' },
    { clave: 'asistencia', tarea: 'cierre-asistencia' },
    { clave: 'encuesta' },
  ],
  'email.birthday': [{ clave: 'cron', tarea: 'cumpleanos' }],
  'email.daily_digest': [{ clave: 'cron', tarea: 'resumen-diario' }],
  'email.task_reminder': [{ clave: 'cron', tarea: 'recordatorio-tareas' }],
  'email.collection_overdue': [{ clave: 'cron', tarea: 'collection-emails' }],
  'email.team_new_reservation': [{ clave: 'equipo' }],
  'email.team_group_request': [{ clave: 'equipo' }],
  'email.team_waitlist': [{ clave: 'equipo' }],
};

/**
 * Cuánto puede pasar sin noticias de una tarea antes de darla por detenida.
 *
 * Generoso a propósito: la diaria corre una vez al día y un margen ajustado la marcaría en rojo
 * cada mañana antes de su hora. Lo que se quiere detectar es «nadie creó este cron», no un
 * retraso de minutos.
 */
export const HORAS_SIN_CORRER_PARA_ALARMA = 36;
