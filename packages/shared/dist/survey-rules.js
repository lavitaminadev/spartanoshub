"use strict";
/**
 * @fileoverview Reglas de una encuesta que deben dar lo mismo en la página pública y en el servidor.
 *
 * Qué preguntas se muestran según lo contestado, cuáles son obligatorias en ese momento y si un
 * dato de contacto está bien escrito. Vive aquí para que la página nunca exija algo que el
 * servidor no pide, ni el servidor rechace algo que la página dejó enviar.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATOS_DE_CONTACTO = void 0;
exports.preguntaVisible = preguntaVisible;
exports.preguntasVisibles = preguntasVisibles;
exports.rutValido = rutValido;
exports.formatearRut = formatearRut;
exports.errorDeDato = errorDeDato;
exports.problemasDeRespuesta = problemasDeRespuesta;
exports.pideDatosPersonales = pideDatosPersonales;
exports.traeDatosPersonales = traeDatosPersonales;
/** Nombre visible y tipo de campo de cada dato de contacto. */
exports.DATOS_DE_CONTACTO = {
    nombre: { etiqueta: 'Nombre', pregunta: 'Tu nombre', placeholder: 'Nombre y apellido', autocompletar: 'name', tipo: 'text' },
    rut: { etiqueta: 'RUT', pregunta: 'Tu RUT', placeholder: '12.345.678-9', autocompletar: 'off', tipo: 'text' },
    correo: { etiqueta: 'Correo', pregunta: 'Tu correo', placeholder: 'nombre@correo.cl', autocompletar: 'email', tipo: 'email' },
    telefono: { etiqueta: 'Teléfono', pregunta: 'Tu teléfono', placeholder: '+56 9 1234 5678', autocompletar: 'tel', tipo: 'tel' },
};
function vacia(valor) {
    return valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');
}
/**
 * Si una pregunta se muestra con las respuestas actuales.
 *
 * Una pregunta con `mostrarSi` sólo aparece cuando la pregunta de la que depende tiene uno de los
 * valores elegidos. Si esa pregunta a su vez está oculta, ésta también: una cadena de reglas no
 * puede mostrar algo cuyo origen nadie vio.
 */
function preguntaVisible(pregunta, preguntas, respuestas, visitadas = new Set()) {
    const regla = pregunta.mostrarSi;
    if (!regla?.preguntaId || !regla.valores?.length)
        return true;
    if (visitadas.has(pregunta.id))
        return false;
    visitadas.add(pregunta.id);
    const origen = preguntas.find((item) => item.id === regla.preguntaId);
    if (!origen || !preguntaVisible(origen, preguntas, respuestas, visitadas))
        return false;
    const valor = respuestas[origen.id];
    return !vacia(valor) && regla.valores.map(String).includes(String(valor));
}
/** Las preguntas que ve la persona con lo que lleva contestado, en orden. */
function preguntasVisibles(preguntas, respuestas) {
    return preguntas.filter((pregunta) => preguntaVisible(pregunta, preguntas, respuestas));
}
/** Valida el dígito verificador de un RUT chileno. Acepta puntos, guion y K minúscula. */
function rutValido(valor) {
    const limpio = valor.replace(/[.\s-]/g, '').toUpperCase();
    if (!/^\d{7,8}[\dK]$/.test(limpio))
        return false;
    const cuerpo = limpio.slice(0, -1);
    let suma = 0;
    let factor = 2;
    for (let i = cuerpo.length - 1; i >= 0; i -= 1) {
        suma += Number(cuerpo[i]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resto = 11 - (suma % 11);
    const esperado = resto === 11 ? '0' : resto === 10 ? 'K' : String(resto);
    return limpio.slice(-1) === esperado;
}
/** Da formato 12.345.678-9 a un RUT escrito de cualquier forma. */
function formatearRut(valor) {
    const limpio = valor.replace(/[^\dkK]/g, '').toUpperCase().slice(0, 9);
    if (limpio.length < 2)
        return limpio;
    const cuerpo = limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${cuerpo}-${limpio.slice(-1)}`;
}
/** Mensaje de error de un dato de contacto, o `null` si está bien o vacío. */
function errorDeDato(dato, valor) {
    if (!dato || vacia(valor))
        return null;
    const texto = String(valor).trim();
    if (dato === 'rut' && !rutValido(texto))
        return 'El RUT no es válido';
    if (dato === 'correo' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto))
        return 'El correo no es válido';
    if (dato === 'telefono' && texto.replace(/\D/g, '').length < 8)
        return 'El teléfono no es válido';
    if (dato === 'nombre' && texto.length < 2)
        return 'Escribe tu nombre';
    return null;
}
/**
 * Qué falta o está mal en lo contestado, considerando sólo las preguntas visibles.
 *
 * @param omitir Preguntas que no se exigen en este envío (por ejemplo, la nota del flujo por pasos).
 * @returns Una lista de textos listos para mostrar; vacía si se puede enviar.
 */
function problemasDeRespuesta(preguntas, respuestas, omitir = []) {
    const problemas = [];
    for (const pregunta of preguntasVisibles(preguntas, respuestas)) {
        if (omitir.includes(pregunta.id))
            continue;
        const valor = respuestas[pregunta.id];
        if (pregunta.required && vacia(valor)) {
            problemas.push(`Falta: ${pregunta.question}`);
            continue;
        }
        const error = errorDeDato(pregunta.dato, valor);
        if (error)
            problemas.push(error);
    }
    return problemas;
}
/** Si la encuesta pide algún dato que identifica a la persona: entonces se necesita su aceptación. */
function pideDatosPersonales(preguntas) {
    return preguntas.some((pregunta) => Boolean(pregunta.dato));
}
/** Si en lo contestado viene algún dato personal escrito. */
function traeDatosPersonales(preguntas, respuestas) {
    return preguntas.some((pregunta) => pregunta.dato && !vacia(respuestas[pregunta.id]));
}
//# sourceMappingURL=survey-rules.js.map