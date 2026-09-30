"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.esCorreoComercial = esCorreoComercial;
exports.enlaceDeBaja = enlaceDeBaja;
const COMERCIALES = new Set([
    'email.birthday',
    'email.coupon',
    'email.campaign',
]);
function esCorreoComercial(prefijo) {
    return COMERCIALES.has(prefijo);
}
async function enlaceDeBaja(parametros, prefijo, token, alcance) {
    const base = process.env.APP_PUBLIC_URL?.replace(/\/$/, '');
    if (!base || !token || !esCorreoComercial(prefijo))
        return undefined;
    if (parametros) {
        const encendido = await parametros
            .get(`${prefijo}_unsubscribe`, alcance.clientId ?? null, null, alcance.organizationId ?? null)
            .catch(() => true);
        if (encendido === false)
            return undefined;
    }
    return `${base}/api/marketing/suscriptores/baja/${encodeURIComponent(token)}?origen=${encodeURIComponent(prefijo)}`;
}
