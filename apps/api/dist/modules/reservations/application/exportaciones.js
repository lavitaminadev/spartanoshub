"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVISO_DE_RESTRICCIONES = exports.MOTIVO_MAXIMO = exports.MOTIVO_MINIMO = exports.DIAS_QUE_EXIGEN_MOTIVO = exports.FILAS_QUE_EXIGEN_MOTIVO = void 0;
exports.razonesParaExigirMotivo = razonesParaExigirMotivo;
exports.motivoEscrito = motivoEscrito;
exports.marcaDeExportacion = marcaDeExportacion;
exports.tieneRestricciones = tieneRestricciones;
exports.FILAS_QUE_EXIGEN_MOTIVO = 500;
exports.DIAS_QUE_EXIGEN_MOTIVO = 31;
exports.MOTIVO_MINIMO = 10;
exports.MOTIVO_MAXIMO = 500;
function razonesParaExigirMotivo(volumen, conProtegidos) {
    const razones = [];
    if (conProtegidos)
        razones.push('incluye datos de contacto o respuestas del formulario');
    if (volumen.filas > exports.FILAS_QUE_EXIGEN_MOTIVO)
        razones.push(`tiene más de ${exports.FILAS_QUE_EXIGEN_MOTIVO} filas`);
    const desde = volumen.desde ? new Date(volumen.desde).getTime() : NaN;
    const hasta = volumen.hasta ? new Date(volumen.hasta).getTime() : NaN;
    if (Number.isNaN(desde) || Number.isNaN(hasta))
        razones.push('no acota el rango de fechas');
    else if ((hasta - desde) / 86_400_000 > exports.DIAS_QUE_EXIGEN_MOTIVO)
        razones.push(`abarca más de ${exports.DIAS_QUE_EXIGEN_MOTIVO} días`);
    return razones;
}
function motivoEscrito(motivo) {
    const limpio = (motivo ?? '').replace(/\s+/g, ' ').trim();
    return limpio.length >= exports.MOTIVO_MINIMO ? limpio.slice(0, exports.MOTIVO_MAXIMO) : undefined;
}
function marcaDeExportacion(quien, cuando) {
    const fecha = cuando.toLocaleString('es-CL', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Santiago' });
    return `Exportado por ${quien} el ${fecha} · contiene datos personales · uso interno`;
}
exports.AVISO_DE_RESTRICCIONES = 'Tiene restricciones · ver en pantalla';
const CLAVES_DE_RESTRICCION = new Set(['dietaryNotes', 'accessibilityNeed']);
const PALABRAS_DE_RESTRICCION = /alerg|restric|diet|celiac|celíac|intoler|vegan|vegetar|accesib|movilidad|silla de ruedas/i;
const SIN_RESTRICCION = /^(no|ninguna?|nada|n\/a|-|sin restricciones?)$/i;
function tieneRestricciones(answers, etiquetaDe) {
    if (!answers || typeof answers !== 'object')
        return false;
    return Object.entries(answers).some(([clave, valor]) => {
        const texto = Array.isArray(valor) ? valor.join(', ') : typeof valor === 'string' ? valor : '';
        if (!texto.trim() || SIN_RESTRICCION.test(texto.trim()))
            return false;
        return CLAVES_DE_RESTRICCION.has(clave) || PALABRAS_DE_RESTRICCION.test(`${clave} ${etiquetaDe(clave)}`);
    });
}
