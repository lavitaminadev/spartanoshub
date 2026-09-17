"use strict";
/**
 * @fileoverview Por qué se cerró una solicitud de grupo sin convertirla en reserva.
 *
 * Cerrarlas era un botón y nada más: la solicitud desaparecía de la bandeja sin dejar dicho si el
 * local no tenía fecha, si el precio no les cuadró o si la persona nunca contestó. Cada una de
 * esas causas se corrige de una forma distinta —abrir cupo, revisar precios, responder antes— y
 * sin registrarlas no hay manera de saber cuál está costando más eventos.
 *
 * Las categorías son fijas para poder contarlas; la nota libre queda para lo que no entre en
 * ninguna.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MOTIVOS_DE_CIERRE = void 0;
exports.esMotivoDeCierre = esMotivoDeCierre;
exports.nombreDelMotivo = nombreDelMotivo;
exports.MOTIVOS_DE_CIERRE = [
    { clave: 'sin_fecha', nombre: 'No teníamos fecha o cupo' },
    { clave: 'precio', nombre: 'No aceptaron el precio' },
    { clave: 'sin_respuesta', nombre: 'Nunca contestaron' },
    { clave: 'eligio_otro', nombre: 'Eligieron otro lugar' },
    { clave: 'duplicada', nombre: 'Repetida o de prueba' },
    { clave: 'otro', nombre: 'Otro motivo' },
];
const POR_CLAVE = new Map(exports.MOTIVOS_DE_CIERRE.map((motivo) => [motivo.clave, motivo.nombre]));
function esMotivoDeCierre(valor) {
    return POR_CLAVE.has(valor);
}
/** El nombre que se muestra, o la clave cruda si llega una que ya no está en el catálogo. */
function nombreDelMotivo(clave) {
    if (!clave)
        return '';
    return POR_CLAVE.get(clave) ?? clave;
}
//# sourceMappingURL=motivos-de-cierre.js.map