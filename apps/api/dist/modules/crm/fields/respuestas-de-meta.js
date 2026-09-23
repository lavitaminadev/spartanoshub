"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.comparable = comparable;
exports.repartirRespuestasDeMeta = repartirRespuestasDeMeta;
function comparable(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}
function valorParaElCampo(campo, crudo) {
    const texto = crudo.trim();
    if (!texto)
        return undefined;
    if (campo.type === 'number') {
        if (!/\d/.test(texto))
            return undefined;
        const numero = Number(texto.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.'));
        return Number.isFinite(numero) ? numero : undefined;
    }
    if (campo.type === 'boolean') {
        const si = ['si', 'sisi', 'yes', 'true', '1'].includes(comparable(texto));
        const no = ['no', 'false', '0'].includes(comparable(texto));
        return si ? true : no ? false : undefined;
    }
    if (campo.type === 'date') {
        const fecha = new Date(texto);
        return Number.isNaN(fecha.getTime()) ? undefined : fecha.toISOString().slice(0, 10);
    }
    if (campo.type === 'select' || campo.type === 'multi_select') {
        const opciones = campo.options ?? [];
        const elegidas = texto.split(/[,;|]/)
            .map((parte) => opciones.find((opcion) => comparable(opcion) === comparable(parte)))
            .filter((opcion) => Boolean(opcion));
        if (elegidas.length === 0)
            return undefined;
        return campo.type === 'select' ? elegidas[0] : [...new Set(elegidas)];
    }
    return texto.slice(0, campo.type === 'long_text' ? 4000 : 255);
}
function repartirRespuestasDeMeta(definiciones, respuestas) {
    const porPregunta = new Map();
    for (const campo of definiciones) {
        if (campo.archivedAt)
            continue;
        for (const pregunta of [campo.key, ...(campo.metaQuestions ?? [])]) {
            const llave = comparable(pregunta);
            if (llave && !porPregunta.has(llave))
                porPregunta.set(llave, campo);
        }
    }
    const camposPropios = {};
    const sinCampo = [];
    for (const respuesta of respuestas) {
        const campo = porPregunta.get(comparable(respuesta.nombre));
        const valor = campo ? valorParaElCampo(campo, respuesta.valor) : undefined;
        if (campo && valor !== undefined)
            camposPropios[campo.key] = valor;
        else
            sinCampo.push(respuesta);
    }
    return { camposPropios, sinCampo };
}
