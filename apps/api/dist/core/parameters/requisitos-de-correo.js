"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HORAS_SIN_CORRER_PARA_ALARMA = exports.REQUISITOS_POR_AVISO = void 0;
exports.REQUISITOS_POR_AVISO = {
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
exports.HORAS_SIN_CORRER_PARA_ALARMA = 36;
