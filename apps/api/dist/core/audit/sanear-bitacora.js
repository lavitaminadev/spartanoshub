"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDACTADO = void 0;
exports.esNombreSensible = esNombreSensible;
exports.sanearTexto = sanearTexto;
exports.sanearParaBitacora = sanearParaBitacora;
exports.REDACTADO = '[REDACTED]';
const RECORTE_DE_TEXTO = 2000;
const PROFUNDIDAD_MAXIMA = 6;
const ELEMENTOS_MAXIMOS = 50;
const NOMBRE_SENSIBLE = /passw|passwd|contrase|secret|token|authorization|cookie|credential|temporary|api[-_ ]?key|private[-_ ]?key|bearer|signature|refresh/i;
const PALABRA_SENSIBLE = new Set(['pin', 'rut', 'clave', 'pwd', 'pass', 'otp', 'cvv']);
function palabrasDe(nombre) {
    return nombre.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9ñ]+/).filter(Boolean);
}
function esNombreSensible(nombre) {
    if (NOMBRE_SENSIBLE.test(nombre))
        return true;
    return palabrasDe(nombre).some((palabra) => PALABRA_SENSIBLE.has(palabra));
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PARAMETRO_SECRETO = /([?&;](?:access_token|refresh_token|id_token|token|api[-_]?key|apikey|key|secret|client_secret|password|passwd|pwd|clave|sig|signature|auth|code)=)[^&\s#"'<>]+/gi;
const CREDENCIAL_EN_URL = /(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/:@]+:[^\s/@]+@/gi;
const SECRETO_NOMBRADO = /\b(password|passwd|contraseña|contrasena|clave|token|secret|secreto|api[-_ ]?key|pin)\s*(?:[:=]|es|is)\s*["']?[^\s"',;&]{3,}/gi;
const FORMAS_DE_TOKEN = [
    /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g,
    /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{8,}/g,
    /\bsk-[A-Za-z0-9_-]{16,}/g,
    /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
    /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
    /\bAKIA[0-9A-Z]{16}\b/g,
    /\bAIza[0-9A-Za-z_-]{30,}/g,
    /\bya29\.[A-Za-z0-9_-]{20,}/g,
    /\bEAA[A-Za-z0-9]{20,}/g,
];
const RUT_EN_TEXTO = /\b\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]\b/g;
const CADENA_OPACA = /[A-Za-z0-9_-]{32,}/g;
function sanearTexto(texto) {
    let limpio = texto
        .replace(CREDENCIAL_EN_URL, `$1${exports.REDACTADO}@`)
        .replace(PARAMETRO_SECRETO, `$1${exports.REDACTADO}`)
        .replace(SECRETO_NOMBRADO, (_, nombre) => `${nombre}=${exports.REDACTADO}`);
    for (const forma of FORMAS_DE_TOKEN)
        limpio = limpio.replace(forma, exports.REDACTADO);
    limpio = limpio.replace(RUT_EN_TEXTO, exports.REDACTADO);
    limpio = limpio.replace(CADENA_OPACA, (cadena) => (UUID.test(cadena) || !/[A-Za-z]/.test(cadena) || !/\d/.test(cadena) ? cadena : exports.REDACTADO));
    return limpio.length > RECORTE_DE_TEXTO ? `${limpio.slice(0, RECORTE_DE_TEXTO)}...` : limpio;
}
function sanearParaBitacora(valor, profundidad = 0) {
    if (valor == null)
        return valor;
    if (typeof valor === 'string')
        return sanearTexto(valor);
    if (typeof valor !== 'object')
        return valor;
    if (valor instanceof Date)
        return valor.toISOString();
    if (profundidad >= PROFUNDIDAD_MAXIMA)
        return '[TRUNCATED]';
    if (Array.isArray(valor))
        return valor.slice(0, ELEMENTOS_MAXIMOS).map((elemento) => sanearParaBitacora(elemento, profundidad + 1));
    return Object.fromEntries(Object.entries(valor).map(([clave, elemento]) => [
        clave,
        esNombreSensible(clave) ? exports.REDACTADO : sanearParaBitacora(elemento, profundidad + 1),
    ]));
}
