/**
 * En qué punto está el plazo legal de una solicitud de derechos.
 *
 * - `respondida`: ya se cerró. El plazo dejó de correr.
 * - `a tiempo`: queda más de una semana.
 * - `por vencer`: queda una semana o menos. Es el aviso útil, porque responder bien toma días.
 * - `vencida`: se pasó. No deja de haber que responder: se responde igual y consta el retraso.
 */
export type EstadoDelPlazo = 'respondida' | 'a tiempo' | 'por vencer' | 'vencida';
export interface PlazoDeSolicitud {
    /** Cuándo vence, contando la prórroga si la hubo. */
    vence: Date;
    /** Días corridos que faltan. Negativo si ya se pasó. */
    diasRestantes: number;
    estado: EstadoDelPlazo;
    /** Si el plazo que corre es el de la prórroga y no el original. */
    prorrogada: boolean;
}
/** Desde cuántos días por vencer se considera urgente. Una semana: responder bien toma días. */
export declare const DIAS_DE_AVISO_DE_PLAZO = 7;
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
export declare function plazoDeSolicitud(recibida: Date | string, opciones?: {
    resuelta?: Date | string | null;
    prorrogadaHasta?: Date | string | null;
    ahora?: Date;
}): PlazoDeSolicitud;
/**
 * Hasta cuándo se puede prorrogar una solicitud: una sola vez y por el mismo plazo.
 *
 * Se calcula desde el vencimiento original y no desde hoy: prorrogar el día 29 no puede dar más
 * tiempo que prorrogar el día 2, porque el plazo es «treinta días más», no «treinta desde que me
 * acordé».
 */
export declare function vencimientoConProrroga(recibida: Date | string): Date;
//# sourceMappingURL=plazo-de-solicitud.d.ts.map