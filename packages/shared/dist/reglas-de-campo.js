"use strict";
/**
 * @fileoverview Cuándo se muestra un campo del formulario, según lo que ya se respondió.
 *
 * Hasta ahora cada pregunta condicional era una bandera en la configuración —«preguntar por
 * niños», «preguntar por alergias»— más una condición escrita a mano en la pantalla pública. Cada
 * pregunta nueva sumaba una bandera, una condición y un estado más que probar, y ninguna de esas
 * combinaciones se podía cambiar sin desplegar.
 *
 * Acá la condición es un dato del campo. Quien arma el formulario decide, sin que nadie toque
 * código, y la misma regla la evalúan el navegador —para mostrar u ocultar— y el servidor —para
 * no exigir lo que no se mostró—. **Que las dos partes usen esta función es el punto**: si el
 * navegador esconde un campo obligatorio y el servidor lo sigue exigiendo, la reserva se vuelve
 * imposible de enviar y el mensaje de error nombra un campo que no está en pantalla.
 *
 * No es un lenguaje de expresiones: una condición, un campo, un valor. Con eso se cubren los
 * casos reales —«si viene con niños, preguntar cuántos»— y se evita tener que explicar precedencia
 * de operadores a quien solo quiere agregar una pregunta.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPERADORES_DE_CAMPO = void 0;
exports.campoVisible = campoVisible;
exports.camposVisibles = camposVisibles;
/** Comparaciones disponibles. Se nombran por lo que significan, no por su símbolo. */
exports.OPERADORES_DE_CAMPO = {
    IGUAL: 'igual',
    DISTINTO: 'distinto',
    RESPONDIDO: 'respondido',
    VACIO: 'vacio',
    MAYOR_QUE: 'mayor_que',
    CONTIENE: 'contiene',
};
function estaVacio(valor) {
    if (valor === null || valor === undefined || valor === false)
        return true;
    if (typeof valor === 'string')
        return valor.trim() === '';
    if (Array.isArray(valor))
        return valor.length === 0;
    return false;
}
/**
 * Si un campo debe mostrarse con las respuestas que hay hasta ahora.
 *
 * Un campo sin regla se muestra siempre. Lo no respondido cuenta como respuesta vacía, así que al
 * abrir el formulario las preguntas condicionales parten ocultas, que es lo que se configuró.
 *
 * @param campo Campo a evaluar.
 * @param respuestas Lo respondido hasta el momento, por identificador de campo.
 */
function campoVisible(campo, respuestas) {
    const regla = campo.mostrarSi;
    if (!regla || !regla.campo)
        return true;
    /*
     * Una respuesta ausente es una respuesta vacía, no una condición que se salta.
     *
     * Al abrir el formulario nada está respondido: si la ausencia mostrara la pregunta, todas las
     * condicionales aparecerían de entrada y recién se esconderían al responder la primera, que es
     * justo al revés de lo que se configuró. El caso distinto —la condición apunta a un campo que
     * ya no existe en el formulario— lo resuelve `camposVisibles`, que sí conoce la lista completa.
     */
    const actual = respuestas[regla.campo];
    const esperado = (regla.valor ?? '').trim();
    switch (regla.operador) {
        case exports.OPERADORES_DE_CAMPO.RESPONDIDO:
            return !estaVacio(actual);
        case exports.OPERADORES_DE_CAMPO.VACIO:
            return estaVacio(actual);
        case exports.OPERADORES_DE_CAMPO.IGUAL:
            return comparables(actual).includes(esperado.toLowerCase());
        /*
         * «Distinta de» exige que haya respuesta.
         *
         * Sin esto, una pregunta condicionada a «distinta de No» aparecía de entrada, porque una
         * respuesta vacía tampoco es «No». Quien configura la regla está pensando en «cuando responda
         * algo que no sea No», no en «mientras no haya contestado». Para el otro caso está `vacio`,
         * que existe justamente para preguntarlo de frente.
         */
        case exports.OPERADORES_DE_CAMPO.DISTINTO:
            return !estaVacio(actual) && !comparables(actual).includes(esperado.toLowerCase());
        case exports.OPERADORES_DE_CAMPO.CONTIENE:
            return !estaVacio(actual) && comparables(actual).some((valor) => valor.includes(esperado.toLowerCase()));
        case exports.OPERADORES_DE_CAMPO.MAYOR_QUE: {
            const numero = Number(actual);
            const limite = Number(esperado);
            return Number.isFinite(numero) && Number.isFinite(limite) && numero > limite;
        }
        default:
            // Un operador que esta versión no conoce no puede esconder la pregunta: se muestra.
            return true;
    }
}
/**
 * Los valores de una respuesta en minúsculas, para comparar sin sorpresas.
 *
 * Una selección múltiple responde una lista; el resto, un valor suelto. Tratar ambos igual evita
 * que «igual a X» funcione en un tipo de campo y en otro no, que es el tipo de diferencia que
 * nadie descubre hasta que un formulario en producción no muestra lo que debía.
 */
function comparables(valor) {
    if (Array.isArray(valor))
        return valor.map((entrada) => String(entrada).trim().toLowerCase());
    if (valor === null || valor === undefined)
        return [''];
    if (typeof valor === 'boolean')
        return [valor ? 'true' : 'false'];
    return [String(valor).trim().toLowerCase()];
}
/**
 * Los campos que hoy corresponde mostrar.
 *
 * Se recorre en orden y arrastrando lo ya decidido: si una pregunta está oculta, las que dependen
 * de ella tampoco aparecen, aunque su propia condición se cumpla por una respuesta vieja que
 * quedó guardada. Sin eso, ocultar una pregunta dejaría visibles a sus hijas.
 */
function camposVisibles(campos, respuestas) {
    const visibles = [];
    const ocultos = new Set();
    // Una condición huérfana —su campo se borró del formulario— no puede esconder la pregunta:
    // dejaría un formulario incompleto imposible de diagnosticar mirando la página.
    const existentes = new Set(campos.map((campo) => campo.id));
    for (const campo of campos) {
        const huerfana = Boolean(campo.mostrarSi?.campo && !existentes.has(campo.mostrarSi.campo));
        const dependeDeUnoOculto = Boolean(campo.mostrarSi?.campo && ocultos.has(campo.mostrarSi.campo));
        if (huerfana || (!dependeDeUnoOculto && campoVisible(campo, respuestas)))
            visibles.push(campo);
        else
            ocultos.add(campo.id);
    }
    return visibles;
}
//# sourceMappingURL=reglas-de-campo.js.map