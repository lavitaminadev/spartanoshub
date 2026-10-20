"use strict";
/**
 * @fileoverview Qué campos son datos protegidos, y cómo se ocultan.
 *
 * El nivel —`oculto`, `bajo_registro` o `directo`— lo decide el perfil de cada persona en cada
 * módulo, y vive en `areas.ts`. Aquí está la otra mitad: **cuáles son esos campos**, y la función
 * que recorta un objeto antes de que salga.
 *
 * DOS REGLAS QUE SOSTIENEN TODO LO DEMÁS
 *
 * 1. **Se recorta al serializar, no al pintar.** Si el filtro vive en el navegador, el dato ya
 *    viajó y el control es decorativo: basta mirar la respuesta en las herramientas del
 *    navegador. La auditoría encontró respuestas que mandan veinte campos para pintar cinco.
 *
 * 2. **La exportación pasa por aquí igual que la pantalla.** Proteger la ficha y no el archivo no
 *    protege nada: quien quiera el dato lo descarga. Lo mismo vale para cualquier API futura.
 *
 * Y UNA QUE DECIDE LOS CORREOS
 *
 * Un correo **no puede** ser `bajo_registro`: no hay forma de saber quién lo leyó, así que no
 * deja la constancia que ese nivel significa. Por eso el correo nunca lleva datos protegidos —
 * lleva el aviso y el enlace a la ficha, donde sí se registra quién miró—. Es además la opción
 * que protege los textos futuros: lo que el código no entrega, ninguna plantilla puede imprimir.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARCA_PROTEGIDA = exports.CAMPOS_PROTEGIDOS = void 0;
exports.camposProtegidosDe = camposProtegidosDe;
exports.recortarProtegidos = recortarProtegidos;
exports.recortarListaProtegidos = recortarListaProtegidos;
exports.sePuedePedir = sePuedePedir;
exports.estaProtegido = estaProtegido;
exports.columnasAQuitar = columnasAQuitar;
exports.CAMPOS_PROTEGIDOS = [
    // Reserva: lo que el comensal dejó al reservar.
    { campo: 'guestPhone', modulo: 'reservations', categoria: 'contacto', nombre: 'Teléfono' },
    { campo: 'guestEmail', modulo: 'reservations', categoria: 'contacto', nombre: 'Correo' },
    { campo: 'guestDocument', modulo: 'reservations', categoria: 'identificador', nombre: 'Documento' },
    { campo: 'guestDocumentType', modulo: 'reservations', categoria: 'identificador', nombre: 'Tipo de documento' },
    { campo: 'guestDocumentCountry', modulo: 'reservations', categoria: 'identificador', nombre: 'País del documento' },
    { campo: 'birthDate', modulo: 'reservations', categoria: 'identificador', nombre: 'Fecha de nacimiento' },
    /*
     * Las respuestas del formulario van enteras.
     *
     * Es donde viven las alergias y restricciones, que son datos de salud, y el local decide qué
     * más pregunta: no hay forma de saber de antemano qué campo trae un dato sensible. Recortar
     * sólo los que hoy reconocemos dejaría fuera el que alguien agregue mañana.
     */
    { campo: 'answers', modulo: 'reservations', categoria: 'sensible', nombre: 'Respuestas del formulario' },
    // Prospecto del CRM.
    { campo: 'phone', modulo: 'crm', categoria: 'contacto', nombre: 'Teléfono' },
    { campo: 'email', modulo: 'crm', categoria: 'contacto', nombre: 'Correo' },
    { campo: 'documentNumber', modulo: 'crm', categoria: 'identificador', nombre: 'Documento' },
    // Quien respondió una encuesta.
    { campo: 'respondentName', modulo: 'surveys', categoria: 'contacto', nombre: 'Nombre' },
    { campo: 'respondentEmail', modulo: 'surveys', categoria: 'contacto', nombre: 'Correo' },
    { campo: 'respondentPhone', modulo: 'surveys', categoria: 'contacto', nombre: 'Teléfono' },
    // Suscriptor de marketing.
    { campo: 'email', modulo: 'marketing', categoria: 'contacto', nombre: 'Correo' },
    { campo: 'phone', modulo: 'marketing', categoria: 'contacto', nombre: 'Teléfono' },
];
function camposProtegidosDe(modulo) {
    return exports.CAMPOS_PROTEGIDOS.filter((entrada) => entrada.modulo === modulo);
}
/** Lo que la pantalla recibe en lugar del valor, para poder decir que existe y está protegido. */
exports.MARCA_PROTEGIDA = '__protegido__';
/**
 * Recorta de un objeto los campos protegidos de un módulo, según el nivel de quien lo pidió.
 *
 * Con `directo` no toca nada. Con `oculto` y con `bajo_registro` recorta igual: la diferencia
 * entre los dos **no es qué se entrega, es si existe la forma de pedirlo**. Entregar el dato y
 * confiar en que la pantalla no lo pinte sería el error que esta función existe para evitar.
 *
 * No muta el objeto recibido.
 */
function recortarProtegidos(objeto, modulo, nivel) {
    if (nivel === 'directo')
        return { datos: objeto, recortados: [], exigeConstancia: false };
    const campos = camposProtegidosDe(modulo);
    const copia = { ...objeto };
    const recortados = [];
    for (const { campo } of campos) {
        if (!(campo in copia))
            continue;
        if (copia[campo] === null || copia[campo] === undefined)
            continue;
        copia[campo] = exports.MARCA_PROTEGIDA;
        recortados.push(campo);
    }
    return { datos: copia, recortados, exigeConstancia: nivel === 'bajo_registro' };
}
/** La misma regla sobre una lista. */
function recortarListaProtegidos(objetos, modulo, nivel) {
    if (nivel === 'directo')
        return { datos: [...objetos], recortados: [], exigeConstancia: false };
    const recortes = objetos.map((objeto) => recortarProtegidos(objeto, modulo, nivel));
    const recortados = [...new Set(recortes.flatMap((recorte) => recorte.recortados))];
    return { datos: recortes.map((recorte) => recorte.datos), recortados, exigeConstancia: nivel === 'bajo_registro' };
}
/**
 * Si un campo recortado se puede pedir, o no existe la forma.
 *
 * Es la única diferencia visible entre los dos niveles que recortan, y es la que la pantalla
 * necesita para decidir si dibuja el botón «ver».
 */
function sePuedePedir(nivel) {
    return nivel === 'bajo_registro';
}
/** Si el valor que llegó es la marca y no el dato. */
function estaProtegido(valor) {
    return valor === exports.MARCA_PROTEGIDA;
}
/**
 * Las columnas de una exportación que hay que quitar para un nivel dado.
 *
 * El archivo sale sin ellas, no con la marca: un CSV con `__protegido__` en una columna es un
 * archivo que alguien va a intentar procesar.
 */
function columnasAQuitar(modulo, nivel) {
    if (nivel === 'directo')
        return [];
    return camposProtegidosDe(modulo).map((entrada) => entrada.campo);
}
//# sourceMappingURL=datos-protegidos.js.map