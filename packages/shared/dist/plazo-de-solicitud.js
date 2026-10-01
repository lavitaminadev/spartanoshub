"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIAS_DE_AVISO_DE_PLAZO = void 0;
exports.plazoDeSolicitud = plazoDeSolicitud;
exports.vencimientoConProrroga = vencimientoConProrroga;
const documentos_legales_1 = require("./documentos-legales");
/** Desde cuántos días por vencer se considera urgente. Una semana: responder bien toma días. */
exports.DIAS_DE_AVISO_DE_PLAZO = 7;
/**
 * Calcula el plazo de respuesta de una solicitud de derechos.
 *
 * Son **días corridos**, no hábiles, y se cuentan desde que entra la solicitud. La prórroga es de
 * una sola vez y por hasta el mismo plazo, y hay que avisarla antes del vencimiento explicando el
 * motivo: por eso aquí se parte de la fecha de prórroga guardada y no se calcula sola. Una
 * prórroga que el sistema se concede a sí mismo no es una prórroga, es un incumplimiento tarde.
 *
 * Nada de esto se calculaba: el plazo estaba escrito en las políticas que el comensal lee y en
 * ningún lugar del sistema, así que una solicitud podía vencer sin que nadie se enterara. Lo que
 * se incumple no es «no responder», es «no responder a tiempo», y sin fecha no hay a tiempo.
 *
 * @param recibida Cuándo entró la solicitud.
 * @param prorrogadaHasta Hasta cuándo se prorrogó, si se hizo y se avisó.
 * @param ahora Para poder probarlo sin depender del reloj.
 */
function plazoDeSolicitud(recibida, opciones = {}) {
    const inicio = new Date(recibida);
    const ahora = opciones.ahora ?? new Date();
    const prorroga = opciones.prorrogadaHasta ? new Date(opciones.prorrogadaHasta) : null;
    const prorrogada = Boolean(prorroga && !Number.isNaN(prorroga.getTime()));
    const vence = prorrogada
        ? prorroga
        : new Date(inicio.getTime() + documentos_legales_1.PLAZO_RESPUESTA_DERECHOS_DIAS * 86_400_000);
    const diasRestantes = Math.ceil((vence.getTime() - ahora.getTime()) / 86_400_000);
    const estado = opciones.resuelta
        ? 'respondida'
        : diasRestantes < 0 ? 'vencida'
            : diasRestantes <= exports.DIAS_DE_AVISO_DE_PLAZO ? 'por vencer'
                : 'a tiempo';
    return { vence, diasRestantes, estado, prorrogada };
}
/**
 * Hasta cuándo se puede prorrogar una solicitud: una sola vez y por el mismo plazo.
 *
 * Se calcula desde el vencimiento original y no desde hoy: prorrogar el día 29 no puede dar más
 * tiempo que prorrogar el día 2, porque el plazo es «treinta días más», no «treinta desde que me
 * acordé».
 */
function vencimientoConProrroga(recibida) {
    const inicio = new Date(recibida);
    return new Date(inicio.getTime() + 2 * documentos_legales_1.PLAZO_RESPUESTA_DERECHOS_DIAS * 86_400_000);
}
//# sourceMappingURL=plazo-de-solicitud.js.map