"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.origenDeCaptacion = origenDeCaptacion;
function limpiar(valor) {
    return (valor ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}
function origenDeCaptacion(local, canal, campana) {
    const partes = [`captación · ${local}`];
    const sitio = limpiar(canal);
    if (sitio)
        partes.push(sitio);
    const cual = limpiar(campana);
    if (cual)
        partes.push(`campaña ${cual}`);
    return partes.join(' · ').slice(0, 255);
}
