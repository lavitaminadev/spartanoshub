"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VIGENCIA_INVITACION_SEGUNDOS = void 0;
exports.crearInvitacion = crearInvitacion;
exports.leerInvitacion = leerInvitacion;
const node_crypto_1 = require("node:crypto");
exports.VIGENCIA_INVITACION_SEGUNDOS = 30 * 24 * 3600;
function clave(secreto) {
    return (0, node_crypto_1.createHmac)('sha256', secreto).update('espartanos:invitacion-a-encuesta:v1').digest();
}
function firmar(cuerpo, secreto) {
    return (0, node_crypto_1.createHmac)('sha256', clave(secreto)).update(cuerpo).digest('base64url');
}
function crearInvitacion(surveyId, reservationId, secreto, ahora = Date.now()) {
    if (!secreto)
        throw new Error('Falta el secreto para firmar la invitación');
    const cuerpo = Buffer.from(JSON.stringify({
        s: surveyId,
        r: reservationId,
        x: Math.floor(ahora / 1000) + exports.VIGENCIA_INVITACION_SEGUNDOS,
    })).toString('base64url');
    return `${cuerpo}.${firmar(cuerpo, secreto)}`;
}
function leerInvitacion(token, surveyId, secreto, ahora = Date.now()) {
    if (!token || !secreto || token.length > 600)
        return null;
    const partes = token.split('.');
    if (partes.length !== 2)
        return null;
    const [cuerpo, firma] = partes;
    const esperada = Buffer.from(firmar(cuerpo, secreto));
    const recibida = Buffer.from(firma);
    if (esperada.length !== recibida.length || !(0, node_crypto_1.timingSafeEqual)(esperada, recibida))
        return null;
    let datos;
    try {
        datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    }
    catch {
        return null;
    }
    if (typeof datos.s !== 'string' || typeof datos.r !== 'string' || typeof datos.x !== 'number')
        return null;
    if (datos.s !== surveyId)
        return null;
    if (datos.x * 1000 < ahora)
        return null;
    return { surveyId: datos.s, reservationId: datos.r, expira: datos.x };
}
